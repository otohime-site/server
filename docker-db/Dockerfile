FROM postgres:13
RUN apt-get update && \
    apt-get install -y postgresql-13-periods &&\
    rm -rf /var/lib/apt/lists/*
ADD ./init.sh /docker-entrypoint-initdb.d