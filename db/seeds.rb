Article.find_or_create_by!(title: "hello") { |a| a.views = 0 }
