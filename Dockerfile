# Use Bun's official image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy node_modules from temp directory
# Then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
RUN bun run build || echo "No build script found"

# Copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/tsconfig.json .

# Create keys.txt.example file before switching user
RUN echo "# SiliconFlow API Keys" > keys.txt.example && \
    echo "# Add one API key per line" >> keys.txt.example && \
    echo "# Lines starting with # are comments and will be ignored" >> keys.txt.example && \
    echo "# Empty lines are also ignored" >> keys.txt.example && \
    echo "" >> keys.txt.example && \
    echo "# Example keys (replace with your actual keys):" >> keys.txt.example && \
    echo "# sk-your-api-key-1" >> keys.txt.example && \
    echo "# sk-your-api-key-2" >> keys.txt.example

# Switch to non-root user
USER bun

# Expose port
EXPOSE 3000/tcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/info || exit 1

# Run the app
ENTRYPOINT ["bun", "run", "src/index.ts"]
