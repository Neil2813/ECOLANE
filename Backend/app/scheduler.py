from apscheduler.schedulers.background import BackgroundScheduler
from app.ml import gpr_interpolation, carbon_calculator, lstm_forecast, heat_island, ndvi_processor, noise_model
from app.utils.push_handler import check_and_notify

scheduler = BackgroundScheduler(daemon=True)
_started = False

def start_scheduler():
    global _started
    if _started:
        return
    scheduler.add_job(gpr_interpolation.run, "interval", minutes=30, id="gpr", replace_existing=True)
    scheduler.add_job(carbon_calculator.run, "interval", minutes=30, id="carbon", replace_existing=True)
    scheduler.add_job(lstm_forecast.run, "cron", hour=23, minute=0, id="lstm", replace_existing=True)
    scheduler.add_job(heat_island.run, "interval", days=8, id="heat", replace_existing=True)
    scheduler.add_job(ndvi_processor.run, "interval", days=10, id="ndvi", replace_existing=True)
    scheduler.add_job(noise_model.run, "interval", hours=12, id="noise", replace_existing=True)
    scheduler.add_job(check_and_notify, "interval", minutes=5, id="push", replace_existing=True)
    scheduler.start()
    _started = True

def stop_scheduler():
    global _started
    if scheduler.running:
        scheduler.shutdown(wait=False)
    _started = False
