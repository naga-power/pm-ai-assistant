"""Development PM AI Support System - FastAPI Backend."""

import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from pydantic import BaseModel

from backend.prompts import (
    CHAT_SYSTEM_PROMPT,
    MINUTES_SYSTEM_PROMPT,
    REPORT_SYSTEM_PROMPT,
    RISK_SYSTEM_PROMPT,
    TASK_BREAKDOWN_SYSTEM_PROMPT,
)

load_dotenv()

app = FastAPI(
    title="開発PM AI支援システム",
    description="AI-powered Development PM Support System PoC",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured. Please set it in your environment.",
        )
    return AsyncOpenAI(api_key=api_key)


MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


# --- Request/Response Models ---


class ChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []


class ReportRequest(BaseModel):
    project_name: str
    progress_percent: int
    milestones: str
    achievements: str
    issues: str
    next_plan: str
    additional_info: Optional[str] = None


class RiskRequest(BaseModel):
    project_description: str
    current_status: str
    team_info: Optional[str] = None
    deadline_info: Optional[str] = None
    additional_context: Optional[str] = None


class MinutesRequest(BaseModel):
    meeting_notes: str
    meeting_info: Optional[str] = None


class TaskBreakdownRequest(BaseModel):
    task_description: str
    context: Optional[str] = None
    constraints: Optional[str] = None


class AIResponse(BaseModel):
    content: str
    model: str


# --- Helper ---


async def call_openai(system_prompt: str, user_message: str, history: list[dict[str, str]] | None = None) -> AIResponse:
    client = get_openai_client()
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=4096,
    )
    return AIResponse(
        content=response.choices[0].message.content or "",
        model=MODEL,
    )


# --- API Endpoints ---


@app.get("/api/health")
async def health_check():
    has_key = bool(os.getenv("OPENAI_API_KEY"))
    return {"status": "ok", "openai_configured": has_key, "model": MODEL}


@app.post("/api/chat", response_model=AIResponse)
async def chat(request: ChatRequest):
    """PM業務に関する汎用チャット"""
    return await call_openai(CHAT_SYSTEM_PROMPT, request.message, request.history)


@app.post("/api/report", response_model=AIResponse)
async def generate_report(request: ReportRequest):
    """プロジェクトステータスレポート生成"""
    user_message = f"""以下のプロジェクト情報からステータスレポートを生成してください。

プロジェクト名: {request.project_name}
全体進捗: {request.progress_percent}%
主要マイルストーン: {request.milestones}
今週の成果: {request.achievements}
課題・リスク: {request.issues}
来週の計画: {request.next_plan}
"""
    if request.additional_info:
        user_message += f"補足情報: {request.additional_info}\n"
    return await call_openai(REPORT_SYSTEM_PROMPT, user_message)


@app.post("/api/risk", response_model=AIResponse)
async def analyze_risk(request: RiskRequest):
    """リスク分析"""
    user_message = f"""以下のプロジェクト情報からリスク分析を実施してください。

プロジェクト概要: {request.project_description}
現在の状況: {request.current_status}
"""
    if request.team_info:
        user_message += f"チーム情報: {request.team_info}\n"
    if request.deadline_info:
        user_message += f"納期情報: {request.deadline_info}\n"
    if request.additional_context:
        user_message += f"追加コンテキスト: {request.additional_context}\n"
    return await call_openai(RISK_SYSTEM_PROMPT, user_message)


@app.post("/api/minutes", response_model=AIResponse)
async def generate_minutes(request: MinutesRequest):
    """会議議事録生成"""
    user_message = f"""以下の会議メモから議事録を作成してください。

{request.meeting_notes}
"""
    if request.meeting_info:
        user_message += f"\n会議情報: {request.meeting_info}\n"
    return await call_openai(MINUTES_SYSTEM_PROMPT, user_message)


@app.post("/api/task-breakdown", response_model=AIResponse)
async def breakdown_task(request: TaskBreakdownRequest):
    """タスク分解"""
    user_message = f"""以下のタスクを具体的なサブタスクに分解してください。

タスク/機能要件: {request.task_description}
"""
    if request.context:
        user_message += f"背景・コンテキスト: {request.context}\n"
    if request.constraints:
        user_message += f"制約条件: {request.constraints}\n"
    return await call_openai(TASK_BREAKDOWN_SYSTEM_PROMPT, user_message)


# --- Serve Frontend ---

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
