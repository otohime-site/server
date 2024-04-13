#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/docker-entrypoint.sh
if [ "$#" -eq 0 ] || [ "$1" != 'postgres' ]; then
	set -- postgres "$@"
fi

docker_setup_env
docker_create_db_directories
mkdir /work && chown postgres /work 
if [ "$(id -u)" = '0' ]; then
	# then restart script as postgres user
	exec gosu postgres "$BASH_SOURCE" "$@"
fi
if [ -z "$DATABASE_ALREADY_EXISTS" ]; then
	docker_verify_minimum_env
    docker_init_database_dir

	cd /work && pg_upgrade \
	--old-datadir /var/lib/postgresql/13/data/pgdata \
	--new-datadir /var/lib/postgresql/16/data/pgdata \
	--old-bindir /usr/lib/postgresql/13/bin \
	--new-bindir /usr/lib/postgresql/16/bin

	cat /work/update_extensions.sql
	pg_setup_hba_conf "$@"
	export PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"
	docker_temp_server_start "$@"
	docker_process_sql -f /work/update_extensions.sql
	docker_temp_server_stop
	unset PGPASSWORD
	echo "All should be OK?"
fi