# Deployment

## Executable Deployment

dtm currently supports direct installation by brew, not by apt/yum, etc. You can download the corresponding version from github or compile the relevant binaries via the go environment.

#### compile

You need to have go 1.16 or higher to compile the binaries with the following command
```
go build
```

#### Configuration

You can set the relevant environment variables (see [Deployment Basics](./base)), or you can create a conf.yml file in your working directory by referring to [sample configuration file](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml)

#### Start

dtm will listen to
- HTTP: 36789
- gRPC: 36790

```
./dtm -c ./conf.yml
```

## Docker Deployment

#### Docker start

``` bash
docker run --name dtm -p 36789:36789 -p 36790:36790 -e STORE_DRIVER=mysql -e STORE_HOST=localhost -e STORE_USER=root -e STORE_PASSWORD= -e STORE_ PORT=3306 -e IS_DOCKER=1 yedf/dtm:latest
```

For each configuration item, see [Deployment Basics](./base)

#### docker-compose startup
Example docker-compose.yaml file:
``` yml
version: '3'
services:
  dtm:
    image: yedf/dtm
    environment:
      IS_DOCKER: 1
      STORE_DRIVER: mysql
      STORE_HOST: localhost
      STORE_USER: root
      STORE_PASSWORD: ''
      STORE_PORT: 3306
    ports:
      - '36789:36789'
      - '36790:36790'
```

#### Other commands for containers

Interactively use the dtm container

``` docker exec -it dtm sh ```

Viewing logs

```docker logs -f dtm ```

## Kubernetes deployment

The current dtm supports HTTP/GRPC protocol, you can add K8S deployment configuration to the previous docker deployment to complete the K8S deployment, a reference to deployment.yml is given below

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dtm
  labels:
    app: dtm
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dtm
  template:
    metadata:
      labels:
        app: dtm
    spec:
      containers:
        - name: dtm
          image: yedf/dtm:latest
          imagePullPolicy: IfNotPresent
          args:
            - "-c=/app/dtm/configs/config.yaml"
          volumeMounts:
            - mountPath: /app/dtm/configs
              name: config
          ports:
            - containerPort: 36789
              protocol: TCP
              name: http
            - containerPort: 36790
              protocol: TCP
              name: grpc
          livenessProbe:
            httpGet:
              path: /api/ping
              port: 36789
              scheme: HTTP
          readinessProbe:
            httpGet:
              path: /api/ping
              port: 36789
              scheme: HTTP
          resources:
            requests:
              cpu: 200m
              memory: 200Mi
      volumes:
        - name: config
          configMap:
            name: dtm-conf
---apiVersion: v1
apiVersion: v1
kind: ConfigMap
metadata:
  name: dtm-conf
  labels:
    app: dtm
data:
  config.yaml: |-
    store:
      Driver: mysql # Here mysql is used as an example, other databases can be replaced by yourself
      Host: dtm-db # This is set to the database host outside the cluster, or the database svc-dns inside the cluster
      Port: 3306
      User: root
      Password: ''
---
apiVersion: v1
kind: Service
metadata:
  name: dtm-svc
  labels:
    app: dtm
spec:
  ports:
    - port: 36790
      targetPort: 36790
      name: grpc
      appProtocol: grpc # Kubernetes v1.20 [stable], exclude this line for lower versions
    - port: 36789
      targetPort: 36789
      name: http
      appProtocol: http # Kubernetes v1.20 [stable], exclude this line for lower versions
  selector:
    app: dtm
  type: ClusterIP
--
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dtm-ing
spec:
  rules:
    - host: "your-domain.com"
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dtm-svc
                port:
                  number: 36789 # This is the http server, grpc server setting, please visit https://kubernetes.github.io/ingress-nginx/examples/grpc/
  ingressClassName: nginx # Other ingressClassName is used, please check it yourself
```


## Helm deployment

#### Using

Install DTM chart:

```bash
helm install --create-namespace -n dtm-system dtm . /charts
```

Upgrade DTM chart:

```bash
helm upgrade -n dtm-system dtm . /charts
```

Dismantle DTM chart:

```bash
helm delete -n dtm-system dtm
```

#### Configuration parameters

| Key | Description | Value |
|-----------------|----------------------------------------------------------------------------------------------------------------|-------|
| `configuration` | DTM configuration. Generate `config.yaml` for DTM, ref: [sample config](https://github.com/dtm-labs/dtm/blob/main/conf.sample.yml) | `""` |



#### Autoscaling parameters

| Name | Description | Value |
|-------------------------------------------------|--------------------|---------|
| `autoscaling.enabled` | enable pods elastic scaling for DTM | `false` |
| `autoscaling.minReplicas` | Minimum number of DTM copies | `1` |
| `autoscaling.maxReplicas` | Maximum number of DTM replicas | `10` |
| `autoscaling.targetCPUUtilizationPercentage` | target CPU utilization | `80` |
| `autoscaling.targetMemoryUtilizationPercentage` | target memory utilization | `80` |

#### Ingress parameters

| Key | Description | Value |
|--------------------------------|--------------------------------------------------|---------------------|
| `ingress.enabled` | enable ingress for DTM | `false` |
| `i