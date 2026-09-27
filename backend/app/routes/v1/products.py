"""Product catalog routes - thin HTTP adapters over product logic.

Country and currency arrive as ``Accept-Country`` / ``Accept-Currency`` headers,
per the multi-country contract in the PRD.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.products import (
    DEFAULT_PAGE_SIZE,
    CategoryList,
    ProductPage,
    ProductResponse,
    get_product,
    list_categories,
    list_products,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductPage, responses=standard_error_responses())
async def read_products(
    accept_country: str = Header(default="KE", alias="Accept-Country"),
    accept_currency: str = Header(default="KES", alias="Accept-Currency"),
    q: str | None = Query(default=None, description="Free-text match on name or brand"),
    category: str | None = Query(default=None),
    supplier_id: str | None = Query(default=None),
    dentist_recommended: bool | None = Query(default=None),
    in_stock: bool = Query(default=True),
    quantity: int = Query(default=1, ge=1, description="Quantity to price each result for"),
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> ProductPage:
    """Search the oral-care catalog.

    Pass ``quantity`` to have every result priced for that quantity - the
    response's ``pricing`` block reports the tier, unit price, and line total.
    """
    return await list_products(
        state,
        country_code=accept_country,
        currency=accept_currency,
        quantity=quantity,
        query=q,
        category=category,
        supplier_id=supplier_id,
        dentist_recommended=dentist_recommended,
        in_stock=in_stock,
        limit=limit,
        offset=offset,
    )


@router.get("/categories", response_model=CategoryList, responses=standard_error_responses())
async def read_categories(
    accept_country: str = Header(default="KE", alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> CategoryList:
    """List the product categories stocked in a country."""
    return await list_categories(state, country_code=accept_country)


@router.get("/{product_id}", response_model=ProductResponse, responses=standard_error_responses())
async def read_product(
    product_id: str,
    accept_country: str = Header(default="KE", alias="Accept-Country"),
    quantity: int = Query(default=1, ge=1),
    state: AppState = Depends(get_app_state),
) -> ProductResponse:
    """Fetch a single product, priced for ``quantity``."""
    return await get_product(state, product_id, quantity=quantity)
