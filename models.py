from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    color: str = "#7cff2e"


class TagCreate(BaseModel):
    name: str


class TimerStart(BaseModel):
    title: str
    project_id: int
    tags: list[str] = []


class EntryCreate(BaseModel):
    title: str
    project_id: int
    start_time: str
    end_time: str
    tags: list[str] = []


class EntryUpdate(BaseModel):
    title: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    project_id: int | None = None
    tags: list[str] | None = None
