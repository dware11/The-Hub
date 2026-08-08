# Docker deployment

Use the production Compose configuration:

```bash
docker compose up --build
```

`docker-compose.override.yml` deliberately selects `Dockerfile.production`.
That image performs a locked `npm ci`, builds the Next.js application,
removes development dependencies, and runs the production server as a
non-root user.

Docker Desktop must be running with the Linux container engine available.

Runtime configuration is read from `.env.local` when that file exists.
Do not commit `.env.local` or bake secrets into an image.

To build without Compose, specify the production file explicitly:

```bash
docker build -f Dockerfile.production -t code-engineering-hub .
```

Then supply the required environment variables when running the image.
