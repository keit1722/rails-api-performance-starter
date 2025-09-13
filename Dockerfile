FROM ruby:3.3-slim

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends build-essential libpq-dev git libyaml-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存インストールをレイヤー分離
COPY Gemfile Gemfile.lock /app/
RUN bundle install

# アプリ本体
COPY . /app

# Puma を 0.0.0.0:3000 で起動（Docker 外からアクセス可能に）
EXPOSE 3000
CMD ["bash", "-lc", "bundle exec rails db:prepare && bundle exec puma -b tcp://0.0.0.0:3000"]