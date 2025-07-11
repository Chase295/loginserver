# Use the official Nginx image from Docker Hub, Alpine version for smaller size
FROM nginx:alpine

# Remove the default Nginx configuration file
RUN rm /etc/nginx/conf.d/default.conf

# Copy the custom nginx.conf to the Nginx configuration directory
# This nginx.conf should be in the same directory as this Dockerfile (the build context)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (though Nginx does this by default, it's good for clarity)
EXPOSE 80
# EXPOSE 443 # If you plan to use SSL

# The default Nginx CMD will start Nginx
# CMD ["nginx", "-g", "daemon off;"]
