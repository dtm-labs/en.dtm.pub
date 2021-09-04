# Docker Deployment

## Docker commands

``` bash
docker run --name dtm -p 8080:8080 -e DB_HOST='localhost' DB_USER='root' DB_PASSWORD='' yedf/dtm:latest
```

The meaning of each parameter has been described in the environment variables section in the previous section

## docker-compose start
docker-compose.yaml:
``` yml
version: '3'
services:
  dtm:
    image: yedf/dtm
    environment:
      - DB_HOST: localhost
      - DB_USER: root
      - DB_PASSWORD: ''
      - DB_PORT: 3306
      - TRANS_CRON_INTERVAL: 10
    ports:
      - '8080:8080'
```

## Other commands for containers

Interactively use the dtm container

``` docker exec -it dtm sh ```

View logs

```docker logs -f dtm ```
