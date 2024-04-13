FROM postgres:16
RUN apt-get update && \
    apt-get install -y postgresql-16-periods &&\
    rm -rf /var/lib/apt/lists/*
ADD ./init.sh /docker-entrypoint-initdb.d