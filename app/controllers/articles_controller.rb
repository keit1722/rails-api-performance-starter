class ArticlesController < ApplicationController
  def show
    article = Article.find(params[:id])
    render json: { id: article.id, title: article.title, views: article.views }
  end

  def create
    title = params[:title].presence || "untitled"
    article = Article.create!(title: title, views: 0)
    render json: { id: article.id, title: article.title, views: article.views }, status: :created
  end
end
