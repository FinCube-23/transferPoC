#!/bin/bash
set -e

host="$1"
shift
cmd="$@"

echo "Waiting for OpenSearch at $host..."

until curl -f "http://$host/_cluster/health" -o /dev/null -s; do
  >&2 echo "OpenSearch is unavailable - sleeping"
  sleep 2
done

>&2 echo "OpenSearch is up - executing command"
exec $cmd