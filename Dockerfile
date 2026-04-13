FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create log directory
RUN mkdir -p /var/log/nginx

# Expose port 443 for HTTPS
EXPOSE 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
