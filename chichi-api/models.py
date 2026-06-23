from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    phone: Optional[str] = None
    province: Optional[str] = None
    kennel_name: Optional[str] = None
    registry: Optional[str] = None
    documents: Optional[dict] = None


class PuppyCreate(BaseModel):
    name: str
    coat_type: str
    gender: str
    color: str
    dob: str
    price: float
    breeding_rights: bool = False
    breeding_rights_price: float = 0
    images: List[str] = []
    pedigree: dict = {}
    health: List[str] = []
    description: str = ''
    registration_no: str = ''
    sire_image: Optional[str] = ''
    dam_image: Optional[str] = ''


class KennelCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    registry: str
    description: str = ''
    location: str = ''
    contact: str = ''
    phone: str = ''
    commission: float = 8.0
    initials: str = ''
    color: str = '#B5651D'
    referral_code: Optional[str] = None


class KennelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    contact: Optional[str] = None
    phone: Optional[str] = None
    commission: Optional[float] = None
    initials: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    membership_status: Optional[str] = None
    membership_expiry: Optional[str] = None
    referral_code: Optional[str] = None
    slug: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    branch_code: Optional[str] = None
    account_type: Optional[str] = None
    logo: Optional[str] = None


class SellerCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    kennel_id: Optional[str] = None
    # status is always set by the server, not the caller


class SellerUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    kennel_id: Optional[str] = None
    status: Optional[str] = None
    warning_date: Optional[str] = None


class TestimonialCreate(BaseModel):
    kennel_id: str
    buyer_name: str
    stars: int
    text: str


class PurchaseRequest(BaseModel):
    puppy_id: str
    buyer_name: str
    buyer_email: EmailStr


class SettingsUpdate(BaseModel):
    default_commission: Optional[float] = None
    membership_fee_annual: Optional[float] = None
    referral_discount: Optional[float] = None
    site_name: Optional[str] = None
    tagline: Optional[str] = None
    admin_bank_name: Optional[str] = None
    admin_account_holder: Optional[str] = None
    admin_account_number: Optional[str] = None
    admin_branch_code: Optional[str] = None
    admin_account_type: Optional[str] = None


class LegalUpdate(BaseModel):
    content: str
