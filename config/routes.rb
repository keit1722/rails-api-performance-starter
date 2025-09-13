Rails.application.routes.draw do
  get  "/health",        to: "health#show"
  get  "/articles/:id",  to: "articles#show"
  post "/articles",      to: "articles#create"
end
