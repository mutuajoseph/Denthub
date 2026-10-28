"""Supplier storefront routes — thin HTTP adapters over supplier logic.

The supplier's own store and its products, all authenticated and gated to
``SUPPLIER_ROLES``. Country and currency arrive as ``Accept-Country`` /
``Accept-Currency`` headers, per the multi-country contract in the PRD.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import current_user, get_app_state
from app.logic.v1.suppliers import (
    CreateProductRequest,
    CreateStoreRequest,
    SupplierProduct,
    SupplierProductList,
    SupplierStore,
    UpdateProductRequest,
    create_my_store,
    create_product,
    get_my_store,
    list_my_products,
    update_product,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

AUTH_RESPONSES = standard_error_responses(401, 403)


@router.get("/me", response_model=SupplierStore, responses=AUTH_RESPONSES)
async def read_my_store(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> SupplierStore:
    """The caller's storefront, or 404 when they have not created one yet."""
    return await get_my_store(state, actor=actor)


@router.post("/me", response_model=SupplierStore, responses=AUTH_RESPONSES)
async def create_store(
    data: CreateStoreRequest,
    accept_country: str = Header(default="KE", alias="Accept-Country"),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> SupplierStore:
    """Create the caller's storefront (one per account, slug derived)."""
    return await create_my_store(
        state,
        actor=actor,
        data=data,
        country_code=accept_country,
    )


@router.get("/me/products", response_model=SupplierProductList, responses=AUTH_RESPONSES)
async def read_my_products(
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> SupplierProductList:
    """One page of the caller's own products, out-of-stock ones included."""
    return await list_my_products(
        state,
        actor=actor,
        limit=limit,
        offset=offset,
    )


@router.post("/me/products", response_model=SupplierProduct, responses=AUTH_RESPONSES)
async def create_my_product(
    data: CreateProductRequest,
    accept_currency: str = Header(default="KES", alias="Accept-Currency"),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> SupplierProduct:
    """List a new product in the caller's own store."""
    return await create_product(
        state,
        actor=actor,
        data=data,
        currency=accept_currency,
    )


@router.patch(
    "/me/products/{product_id}",
    response_model=SupplierProduct,
    responses=AUTH_RESPONSES,
)
async def patch_my_product(
    product_id: str,
    data: UpdateProductRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> SupplierProduct:
    """Partially update one of the caller's own products (404 for the rest)."""
    return await update_product(
        state,
        actor=actor,
        product_id=product_id,
        data=data,
    )
