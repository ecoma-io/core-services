# Dockerfile for Traefik reverse proxy service
# This image sets up Traefik v3.5 with custom configuration files and SSL certificates.

# Use the official Traefik v3.5 image as the base
FROM traefik:v3.6

# Copy static configuration file to the Traefik configuration directory
COPY traefik.yml /etc/traefik/traefik.yml

# Copy dynamic configuration file for runtime adjustments
COPY dynamic.yml /etc/traefik/dynamic.yml

# Copy SSL certificate and key for HTTPS support
COPY cert.crt /certs/cert.crt
COPY cert.key /certs/cert.key

# Expose HTTP port 80 for standard web traffic
EXPOSE 80

# Expose HTTPS port 443 for secure web traffic
EXPOSE 443

# Start Traefik with the specified configuration file
CMD ["--configFile=/etc/traefik/traefik.yml"]
