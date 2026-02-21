# Build Stage: Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Stage: Backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN go build -o arkitect-server ./main.go

# Final Stage: Runs as single service
FROM alpine:latest
WORKDIR /app/backend
# Copy the compiled backend binary
COPY --from=backend-builder /app/backend/arkitect-server /app/backend/arkitect-server
# Copy the built frontend static files
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8080
CMD ["/app/backend/arkitect-server"]

