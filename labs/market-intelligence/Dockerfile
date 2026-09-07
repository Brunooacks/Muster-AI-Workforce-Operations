FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/marketlab

WORKDIR /app

RUN addgroup --system marketlab \
  && adduser --system --home /home/marketlab --ingroup marketlab marketlab \
  && mkdir -p /home/marketlab/.local/share \
  && chown -R marketlab:marketlab /home/marketlab

COPY requirements.txt ./
RUN python -m pip install --upgrade pip && python -m pip install -r requirements.txt

COPY pyproject.toml README.md ./
COPY src ./src
RUN python -m pip install --no-deps .

USER marketlab

EXPOSE 8095
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8095/health', timeout=3)"

CMD ["uvicorn", "market_lab.web:app", "--host", "0.0.0.0", "--port", "8095"]
