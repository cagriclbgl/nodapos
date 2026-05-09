# syntax=docker/dockerfile:1.7

# ---- Build stage -----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore separately so source edits don't bust the dependency layer cache.
COPY PizzaPos.Api.csproj ./
RUN dotnet restore PizzaPos.Api.csproj

COPY . ./
RUN dotnet publish PizzaPos.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    -p:PublishSingleFile=false \
    -p:UseAppHost=false

# ---- Runtime stage ---------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Non-root user for runtime (defense in depth — even if the API gets popped,
# the attacker doesn't land as root inside the container).
RUN groupadd --system --gid 1001 pizzapos \
 && useradd --system --uid 1001 --gid pizzapos --no-create-home pizzapos

COPY --from=build --chown=pizzapos:pizzapos /app/publish ./

USER pizzapos
EXPOSE 5000
ENV ASPNETCORE_URLS=http://0.0.0.0:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    Database__Provider=Postgres \
    DOTNET_RUNNING_IN_CONTAINER=true

# Caddy talks to us via the docker network, so plain HTTP inside the box.
ENTRYPOINT ["dotnet", "PizzaPos.Api.dll"]
