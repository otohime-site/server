FROM postgres:18-trixie
RUN apt-get update && \
    apt-get install -y postgresql-18-periods &&\
    rm -rf /var/lib/apt/lists/*
ADD ./init.sh /docker-entrypoint-initdb.d