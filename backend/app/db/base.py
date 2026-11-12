"""모든 DB 테이블 모델이 상속하는 기반 클래스."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
