FROM --platform=$BUILDPLATFORM golang:1.24.5-alpine AS build
ARG VERSION=dev
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/gostman ./cmd/gostman

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/gostman /usr/local/bin/gostman
WORKDIR /workspace
USER nonroot:nonroot
ENTRYPOINT ["/usr/local/bin/gostman"]
CMD ["help"]
