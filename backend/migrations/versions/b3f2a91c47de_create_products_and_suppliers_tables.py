"""create_products_and_suppliers_tables

Revision ID: b3f2a91c47de
Revises: a7d7d1d0ec25
Create Date: 2026-09-27

Adds the oral-care catalog: `suppliers` (one per seller) and `products`.

Money is `NUMERIC(12,2)` rather than float so retail/wholesale prices stay
exact. `products.wholesale_price` is nullable: a NULL means "derive from retail
at the default discount" rather than "no wholesale", and `wholesale_min_qty`
carries the tier threshold.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3f2a91c47de"
down_revision: Union[str, Sequence[str], None] = "a7d7d1d0ec25"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "suppliers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=150), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_suppliers_slug"), "suppliers", ["slug"], unique=True)

    op.create_table(
        "products",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("supplier_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("brand", sa.String(length=120), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("retail_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("wholesale_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("wholesale_min_qty", sa.Integer(), nullable=False),
        sa.Column("dentist_recommended", sa.Boolean(), nullable=False),
        sa.Column("in_stock", sa.Boolean(), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_products_name"), "products", ["name"], unique=False)
    op.create_index(op.f("ix_products_category"), "products", ["category"], unique=False)
    op.create_index(op.f("ix_products_country_code"), "products", ["country_code"], unique=False)
    op.create_index(op.f("ix_products_supplier_id"), "products", ["supplier_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_products_supplier_id"), table_name="products")
    op.drop_index(op.f("ix_products_country_code"), table_name="products")
    op.drop_index(op.f("ix_products_category"), table_name="products")
    op.drop_index(op.f("ix_products_name"), table_name="products")
    op.drop_table("products")
    op.drop_index(op.f("ix_suppliers_slug"), table_name="suppliers")
    op.drop_table("suppliers")
