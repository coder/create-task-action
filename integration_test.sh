#!/usr/bin/env bash
set -euo pipefail

# Enable VERBOSE mode for troubleshooting: VERBOSE=1 ./setup-coder.sh
if [[ "${VERBOSE:-}" == "1" ]]; then
    set -x
fi

SKIP_CLEANUP="${SKIP_CLEANUP:-}"

REPO_ROOT=$(git rev-parse --show-toplevel)

# Configuration with defaults
CODER_IMAGE="${CODER_IMAGE:-ghcr.io/coder/coder}"
CODER_VERSION="${CODER_VERSION:-latest}"
CODER_PORT="${CODER_PORT:-7080}"
DOCKER_GID="${DOCKER_GID:-}"
CONTAINER_NAME="coder-integration-test"

CODER_USERNAME="testuser"
CODER_EMAIL="test@example.com"
CODER_PASSWORD="testpassword123"
GITHUB_USER_ID="123456789"  # Test GitHub user ID


# Use well-known postgres credentials for testing
POSTGRES_PORT="5433"
POSTGRES_PASSWORD="test-password-$(date +%s)"

# Detect Docker socket path from context
DOCKER_HOST=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || echo "unix:///var/run/docker.sock")
# Extract path from unix:// URL
DOCKER_SOCKET="${DOCKER_HOST#unix://}"

# Setup postgres configuration for embedded database
# We need to pre-configure postgres port and password so we can:
# 1. Connect to the database from outside the container (for linking GitHub user ID)
# 2. Avoid random port assignment which would make connection harder
# Coder reads port/password from ~/.config/coderv2/postgres/{port,password}
# Note: Using repo directory instead of /tmp to avoid issues with Colima and similar setups
POSTGRES_CONFIG_DIR="${REPO_ROOT}/.integration.tmp"

if ! command -v curl; then
    echo "curl is required to run this script"
    exit 1
elif ! command -v docker; then
    echo "Docker is required to run this script"
    exit 1
elif ! command -v act; then
    echo "nektos/act is required to run this script"
    exit 1
elif ! command -v psql; then
    echo "psql is required to run this script"
    exit 1
fi

cleanup() {
    if [[ "${SKIP_CLEANUP}" == "1" ]]; then
        echo "Skipping cleanup, leaving it up to you!"
    else
        now=$(date +%Y%m%d%H%M%S)
        log_dest="./integration_test.${now}.log"
        echo "Writing Coder logs to ${log_dest}"
        docker logs "${CONTAINER_NAME}" > "${log_dest}" 2>&1
        docker rm -f coder-testuser-integration-test-1
        docker rm -f "${CONTAINER_NAME}"
        rm -rfv "${POSTGRES_CONFIG_DIR}"
    fi
}
trap cleanup EXIT

echo "🚀 Setting up ephemeral Coder deployment for integration tests"
echo "   Image: ${CODER_IMAGE}:${CODER_VERSION}"
echo "   Port: ${CODER_PORT}"
echo "   Docker socket: ${DOCKER_SOCKET}"

# Detect Docker socket group ID
detect_docker_gid() {
    if [[ -S "${DOCKER_SOCKET}" ]]; then
        # Linux uses -c, macOS/BSD uses -f
        stat -c '%g' "${DOCKER_SOCKET}" 2>/dev/null || \
        stat -f '%g' "${DOCKER_SOCKET}" 2>/dev/null || \
        echo ""
    fi
}

# Use provided DOCKER_GID or auto-detect
if [[ -z "${DOCKER_GID}" ]]; then
    DOCKER_GID=$(detect_docker_gid)
fi

mkdir -p "${POSTGRES_CONFIG_DIR}"


echo "${POSTGRES_PORT}" > "${POSTGRES_CONFIG_DIR}/port"
echo "${POSTGRES_PASSWORD}" > "${POSTGRES_CONFIG_DIR}/password"
echo "   Postgres port: ${POSTGRES_PORT}"
echo "   Postgres password: (generated)"

# Write a custom entrypoint script to write the port and password to the config directory
# This needs to be done before the container starts so that the port and password are available to the container.
# Mounting the files in directly leads to permission issues.
cat <<EOF > "${POSTGRES_CONFIG_DIR}/entrypoint.sh"
#!/bin/bash
set -euo pipefail
mkdir -p /home/coder/.config/coderv2/postgres
cp /tmp/postgres-port /home/coder/.config/coderv2/postgres/port
cp /tmp/postgres-password /home/coder/.config/coderv2/postgres/password
exec coder server "\${@}"
EOF
chmod +x "${POSTGRES_CONFIG_DIR}/entrypoint.sh"

# Pull the image and log the digest for reproducibility
echo ""
echo "📥 Pulling Coder image..."
FULL_IMAGE="${CODER_IMAGE}:${CODER_VERSION}"
docker pull "${FULL_IMAGE}"

# Build a custom Coder image with the psql client
echo "Building custom Coder image with psql client..."
printf 'FROM %s\nUSER root\nRUN apk update && apk add postgresql-client\nUSER coder' "${FULL_IMAGE}" | docker build -t "${FULL_IMAGE}-psql" -f - .

# Get and log the image digest
IMAGE_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "${FULL_IMAGE}" 2>/dev/null || echo "unknown")
echo "✅ Image pulled: ${FULL_IMAGE}"
echo "   Digest: ${IMAGE_DIGEST}"

# Build docker run command
DOCKER_RUN_ARGS=(
    --name "${CONTAINER_NAME}"
    --rm -d
    -p "${CODER_PORT}:7080"
    -p "${POSTGRES_PORT}:${POSTGRES_PORT}"
    -e CODER_HTTP_ADDRESS=0.0.0.0:7080
    -e CODER_ACCESS_URL="http://localhost:${CODER_PORT}"
    -e CODER_TELEMETRY_ENABLE=false
    -e CODER_VERBOSE=1
    -v "${DOCKER_SOCKET}:/var/run/docker.sock"
    -v "${POSTGRES_CONFIG_DIR}/port:/tmp/postgres-port"
    -v "${POSTGRES_CONFIG_DIR}/password:/tmp/postgres-password"
    -v "${POSTGRES_CONFIG_DIR}/entrypoint.sh:/entrypoint.sh"
    --entrypoint /bin/bash
)

# Add group_add if we have a Docker GID
if [[ -n "$DOCKER_GID" ]]; then
    echo "   Docker socket group: ${DOCKER_GID}"
    DOCKER_RUN_ARGS+=(--group-add "$DOCKER_GID")
else
    echo "   ⚠️  Could not detect Docker socket group, container may lack Docker access"
fi

# Check for a pre-existing container
if docker ps -a --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
    echo "   ⚠️  Container already exists, please remove it before starting a new one"
    echo " docker rm ${CONTAINER_NAME}"
    exit 1
fi

# Start Coder container
echo ""
echo "📦 Starting Coder container..."
docker run "${DOCKER_RUN_ARGS[@]}" "${FULL_IMAGE}-psql" /entrypoint.sh

# Wait for Coder to be healthy
CODER_URL="http://localhost:${CODER_PORT}"
echo ""
echo "⏳ Waiting for Coder to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
    if curl -sSf "${CODER_URL}/healthz" >/dev/null 2>&1; then
        echo "✅ Coder is ready!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
    sleep 2
done

if [[ $ATTEMPT -eq $MAX_ATTEMPTS ]]; then
    echo ""
    echo "❌ Coder failed to start within timeout"
    docker logs "${CONTAINER_NAME}"
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    exit 1
fi

# Create first user
echo ""
echo "👤 Creating first user..."
# Create first user and log in using coder CLI inside container
docker exec "${CONTAINER_NAME}" coder login "${CODER_URL}" \
    --first-user-username "${CODER_USERNAME}" \
    --first-user-email "${CODER_EMAIL}" \
    --first-user-password "${CODER_PASSWORD}"

if [[ $? -ne 0 ]]; then
    echo "❌ Failed to create user or login"
    docker logs "${CONTAINER_NAME}" | tail -20
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    exit 1
fi

echo "✅ User created: ${CODER_USERNAME}"

# Extract session token from container
CODER_TOKEN=$(docker exec "${CONTAINER_NAME}" sh -c 'cat $HOME/.config/coderv2/session' | tr -d '\n')

if [[ -z "$CODER_TOKEN" ]]; then
    echo "❌ Failed to extract session token from container"
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    exit 1
fi

# Link GitHub user ID by updating database directly
echo ""
echo "🔗 Linking GitHub user ID ${GITHUB_USER_ID}..."
# Update the user's github_com_user_id in the database
# Using email as the identifier since it's unique and we know it
POSTGRES_URL="postgres://coder@localhost:5433/coder?sslmode=disable&password=${POSTGRES_PASSWORD}"
echo "UPDATE users SET github_com_user_id = ${GITHUB_USER_ID} WHERE email = '${CODER_EMAIL}';" | docker exec -i "${CONTAINER_NAME}" psql "${POSTGRES_URL}"
if [[ $? -eq 0 ]]; then
    echo "✅ GitHub user linked"
else
    echo "⚠️  Warning: Could not link GitHub user ID"
    exit 1
fi

# Import template
echo ""
echo "📋 Importing Docker template..."
TEMPLATE_NAME="tasks-docker"
docker exec "${CONTAINER_NAME}" sh -c "
    mkdir -p ./${TEMPLATE_NAME} && cd ./${TEMPLATE_NAME}
    coder templates init --id ${TEMPLATE_NAME} .
    terraform init
    coder templates push ${TEMPLATE_NAME} --yes --directory .
"
if [[ $? -ne 0 ]]; then
    echo "❌ Template import failed"
    docker logs "${CONTAINER_NAME}" | tail -20
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    exit 1
fi

echo "✅ Template created: ${TEMPLATE_NAME}"

echo "Running act..."
cd "${REPO_ROOT}" && \
    act issues \
    --secret "CODER_URL=${CODER_URL}" \
    --secret "CODER_TOKEN=${CODER_TOKEN}" \
    --secret "CODER_USERNAME=${CODER_USERNAME}" \
    --secret "CODER_ORGANIZATION=default" \
    --secret "GITHUB_USER_ID=${GITHUB_USER_ID}" \
    --secret "GITHUB_TOKEN=fake-token-for-testing" \
    --workflows ./test-workflow.yml \
    --eventpath ./test-event.json

if [[ $? -ne 0 ]]; then
  echo "Integration test failed"
fi
