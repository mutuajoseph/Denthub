"""Magazine routes - thin HTTP adapters over magazine logic.

Public read-only module per PRD §2, so no role gate. Country resolves like the
jobs routes do: ``country`` names the market being asked about and the ambient
``Accept-Country`` header is the fallback, the more specific one winning.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.country import DEFAULT_COUNTRY_CODE
from app.logic.v1.magazine import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MagazineArticleDetail,
    MagazineCategoryList,
    MagazinePage,
    get_article,
    list_articles,
    list_categories,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/magazine", tags=["magazine"])


@router.get("/articles", response_model=MagazinePage, responses=standard_error_responses())
async def read_articles(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    category: str | None = Query(default=None, description="Filter to one category"),
    tag: str | None = Query(default=None, description="Filter to one tag"),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> MagazinePage:
    """One page of published articles for a market."""
    return await list_articles(
        state,
        country_code=country or accept_country,
        category=category,
        tag=tag,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/articles/{slug}",
    response_model=MagazineArticleDetail,
    responses=standard_error_responses(),
)
async def read_article(
    slug: str,
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> MagazineArticleDetail:
    """One published article by slug.

    ``country`` is accepted for parity with the list route; the article's own
    Country governs the response, so a deep link reads the same from any market.
    """
    return await get_article(state, slug=slug)


@router.get(
    "/categories",
    response_model=MagazineCategoryList,
    responses=standard_error_responses(),
)
async def read_categories(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> MagazineCategoryList:
    """The categories of a country's published articles."""
    return await list_categories(state, country_code=country or accept_country)
