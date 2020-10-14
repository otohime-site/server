FROM postgres:13
RUN apt-get update && \
    apt-get install -y postgresql-contrib-13 postgresql-server-dev-13 wget ca-certificates build-essential unzip &&\
    rm -rf /var/lib/apt/lists/*
RUN wget -O periods.zip https://github.com/xocolatl/periods/archive/v1.2.zip
RUN unzip periods.zip -d /usr/src/periods
RUN ls /usr/src/periods
RUN cd /usr/src/periods/periods-1.2 && make && make install && rm -rf /usr/src/periods
ADD ./init.sh /docker-entrypoint-initdb.d