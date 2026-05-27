FROM minio/mc:latest

COPY init-minio.sh /init-minio.sh

RUN chmod +x /init-minio.sh

ENTRYPOINT ["/bin/sh", "/init-minio.sh"]