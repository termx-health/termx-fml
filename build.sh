ng build

docker build -t docker.kodality.com/termx-fml-editor:latest . --build-arg BUILD_TIME=$(date +%s)
docker push docker.kodality.com/termx-fml-editor:latest

