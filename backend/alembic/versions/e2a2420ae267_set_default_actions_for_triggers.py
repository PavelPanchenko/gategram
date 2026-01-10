"""set_default_actions_for_triggers

Revision ID: e2a2420ae267
Revises: e8c27781d193
Create Date: 2026-01-10 00:03:39.015091

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2a2420ae267'
down_revision: Union[str, None] = 'e8c27781d193'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Обновляем все существующие триггеры, у которых actions = NULL, устанавливаем пустой массив
    op.execute("""
        UPDATE triggers 
        SET actions = '[]'::jsonb 
        WHERE actions IS NULL
    """)


def downgrade() -> None:
    # В downgrade ничего не делаем, так как это просто установка дефолтных значений
    pass

