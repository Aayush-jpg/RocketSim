"""Physics module for rocket simulations."""

from .constants import (
    GRAVITATIONAL_ACCELERATION,
    EARTH_RADIUS,
    AIR_DENSITY_SEA_LEVEL,
    ATMOSPHERIC_SCALE_HEIGHT
)

from .propulsion import (
    PROPULSION_SYSTEMS,
    select_engine_for_altitude
)

from .aerodynamics import (
    calculate_rocket_mass
)

from .trajectory import (
    calculate_max_altitude,
    physics_based_rocket_design
)

__all__ = [
    'GRAVITATIONAL_ACCELERATION',
    'EARTH_RADIUS',
    'AIR_DENSITY_SEA_LEVEL',
    'ATMOSPHERIC_SCALE_HEIGHT',
    'PROPULSION_SYSTEMS',
    'select_engine_for_altitude',
    'calculate_rocket_mass',
    'calculate_max_altitude',
    'physics_based_rocket_design'
] 