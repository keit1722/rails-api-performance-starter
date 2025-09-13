class HealthController < ApplicationController
  def show
    render json: { ok: true, time: Time.now.utc }
  end
end
