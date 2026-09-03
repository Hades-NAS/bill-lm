#!/bin/bash

# test-docker.sh - Script para testear el Dockerfile localmente
# Uso: ./scripts/test-docker.sh [build|run|rebuild]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
ENV_FILE=".env"
DOCKERFILE="docker/Dockerfile"
IMAGE_NAME="bill-lm:test-local"
CONTAINER_NAME="bill-lm-test"
PORT=3000

# Funciones helper
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que el .env existe
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env no encontrado"
    log_info "Buscando alternativas..."
    
    if [ -f ".env.local" ]; then
        ENV_FILE=".env.local"
        log_success "Usando .env.local"
    elif [ -f ".env.example" ]; then
        log_warning "Ningún .env encontrado, usando .env.example (puede que NO tenga valores válidos)"
        ENV_FILE=".env.example"
    else
        log_error "No se encontró ningún archivo de configuración (.env, .env.local o .env.example)"
        exit 1
    fi
fi

log_info "Usando archivo de entorno: $ENV_FILE"

# Verificar que el Dockerfile existe
if [ ! -f "$DOCKERFILE" ]; then
    log_error "Dockerfile no encontrado en $DOCKERFILE"
    exit 1
fi

# Función para extraer variables y convertirlas en --build-arg
get_build_args() {
    declare -a build_args
    
    # Lista de variables esperadas en el Dockerfile
    local variables=(
        "PORT"
        "DATABASE_URL"
        "ENVIRONMENT"
        "MINIO_ENDPOINT"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
        "MINIO_BUCKET_NAME"
        "GOOGLE_APPLICATION_CREDENTIALS"
        "VITE_FIREBASE_API_KEY"
        "VITE_FIREBASE_AUTH_DOMAIN"
        "VITE_FIREBASE_PROJECT_ID"
        "VITE_FIREBASE_STORAGE_BUCKET"
        "VITE_FIREBASE_MESSAGING_SENDER_ID"
        "VITE_FIREBASE_APP_ID"
        "LLM_PROVIDER"
        "MODEL_KEY"
        "LLM_BASE_URL"
        "LLM_TEMPERATURE"
        "OPENAI_MODEL_ID"
        "OPENAI_ORGANIZATION"
        "OPENAI_API_KEY"
        "OPENAI_PROJECT_ID"
    )
    
    for var in "${variables[@]}"; do
        # Leer valor del .env (limpiando comillas)
        value=$(grep "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | sed 's/^"//;s/"$//')
        
        if [ -n "$value" ]; then
            build_args+=("--build-arg" "${var}=${value}")
        else
            # Si no tiene valor, solo pasar el arg sin valor (usará el default del Dockerfile)
            log_warning "Variable $var no encontrada en $ENV_FILE (usará valor por defecto)"
        fi
    done
    
    # Print array for debugging
    printf '%s\n' "${build_args[@]}"
}

# Función para limpiar contenedor anterior
cleanup_container() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Deteniendo y removiendo contenedor anterior..."
        docker stop "$CONTAINER_NAME" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || true
        log_success "Contenedor removido"
    fi
}

# Função para buildear
build_image() {
    log_info "📦 Construyendo imagen Docker..."
    
    # Declare array to hold build args
    declare -a build_args
    
    # Lista de variables esperadas en el Dockerfile
    local variables=(
        "PORT"
        "DATABASE_URL"
        "ENVIRONMENT"
        "MINIO_ENDPOINT"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
        "MINIO_BUCKET_NAME"
        "GOOGLE_APPLICATION_CREDENTIALS"
        "VITE_FIREBASE_API_KEY"
        "VITE_FIREBASE_AUTH_DOMAIN"
        "VITE_FIREBASE_PROJECT_ID"
        "VITE_FIREBASE_STORAGE_BUCKET"
        "VITE_FIREBASE_MESSAGING_SENDER_ID"
        "VITE_FIREBASE_APP_ID"
        "LLM_PROVIDER"
        "ANALYZE_QUEUE_NAME"
        "MODEL_KEY"
        "LLM_BASE_URL"
        "LLM_TEMPERATURE"
        "OPENAI_MODEL_ID"
        "OPENAI_ORGANIZATION"
        "OPENAI_API_KEY"
        "OPENAI_PROJECT_ID"
    )
    
    # Populate build_args
    for var in "${variables[@]}"; do
        value=$(grep "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | sed 's/^"//;s/"$//')
        
        if [ -n "$value" ]; then
            build_args+=("--build-arg" "${var}=${value}")
        else
            log_warning "Variable $var no encontrada en $ENV_FILE (usará valor por defecto)"
        fi
    done
    
    log_info "Variables de build detectadas:"
    printf ' %s\n' "${build_args[@]}" | head -20 | sed 's/^ /  /'
    
    # Build con los args (usar "${build_args[@]}" para expandir array correctamente)
    docker build \
        "${build_args[@]}" \
        -f "$DOCKERFILE" \
        -t "$IMAGE_NAME" \
        . || {
            log_error "Fallo el build"
            exit 1
        }
    
    log_success "Imagen construida"
}

# Función para correr el contenedor
run_container() {
    log_info "🚀 Iniciando contenedor..."
    
    cleanup_container
    
    # Correr con --env-file para que el contenedor cargue las variables en runtime
    docker run \
        --name "$CONTAINER_NAME" \
        --env-file "$ENV_FILE" \
        -p "${PORT}:${PORT}" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        --rm \
        "$IMAGE_NAME" || {
            log_error "Fallo al ejecutar el contenedor"
            exit 1
        }
}

# Comando principal
case "${1:-build}" in
    build)
        build_image
        log_success "Listo para usar. Ejecuta: ./scripts/test-docker.sh run"
        ;;
    run)
        log_info "Verificando si la imagen existe..."
        if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
            log_warning "Imagen no existe, buildeando primero..."
            build_image
        fi
        run_container
        ;;
    rebuild)
        cleanup_container
        build_image
        log_success "Listo para usar. Ejecuta: ./scripts/test-docker.sh run"
        ;;
    clean)
        cleanup_container
        if docker image inspect "$IMAGE_NAME" &>/dev/null; then
            log_info "Removiendo imagen..."
            docker rmi "$IMAGE_NAME"
            log_success "Imagen removida"
        fi
        ;;
    logs)
        docker logs -f "$CONTAINER_NAME" 2>/dev/null || log_error "Contenedor no está corriendo"
        ;;
    help | *)
        echo ""
        echo "📋 Test Docker para bill-lm"
        echo ""
        echo "Uso: ./scripts/test-docker.sh [COMANDO]"
        echo ""
        echo "Comandos:"
        echo "  build      - Buildear la imagen Docker localmente (por defecto)"
        echo "  run        - Correr el contenedor (buildea si es necesario)"
        echo "  rebuild    - Forzar rebuild de la imagen"
        echo "  clean      - Remover imagen y contenedor"
        echo "  logs       - Ver logs del contenedor corriendo"
        echo "  help       - Mostrar esta ayuda"
        echo ""
        echo "💡 El script automáticamente:"
        echo "   - Busca .env (o .env.local, .env.example como fallback)"
        echo "   - Extrae las variables de entorno"
        echo "   - Las pasa como --build-arg durante el build"
        echo "   - Las pasa como --env-file durante el run"
        echo ""
        ;;
esac
