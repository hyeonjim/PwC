"""업무 달력 (A05 2항): 주는 월요일 시작, 영업일은 월~금, 공휴일 없음."""

from datetime import date, timedelta


def is_business_day(d: date) -> bool:
    return d.weekday() < 5


def next_business_day(d: date) -> date:
    """d 가 영업일이면 그대로, 주말이면 다음 월요일."""
    while not is_business_day(d):
        d += timedelta(days=1)
    return d


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def business_days(start: date, end: date) -> list[date]:
    days, d = [], start
    while d <= end:
        if is_business_day(d):
            days.append(d)
        d += timedelta(days=1)
    return days
