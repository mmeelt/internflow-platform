FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline
COPY src/ src/
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S internflow && adduser -S internflow -G internflow \
    && mkdir -p /data/uploads && chown -R internflow:internflow /app /data
COPY --from=build --chown=internflow:internflow /workspace/target/*.jar /app/app.jar
USER internflow
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
