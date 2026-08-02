// Importing this module registers every model with mongoose (so string refs
// resolve regardless of import order) and re-exports them.

export { User } from './User.js';
export { Organisation } from './Organisation.js';
export { AuditLog } from './AuditLog.js';
export { ErrorLog } from './ErrorLog.js';

export { Category } from './Category.js';
export { CategoryAttribute } from './CategoryAttribute.js';
export { Product } from './Product.js';
export { SavedItem } from './SavedItem.js';

// M4 · Enquiry & Chat
export { Inquiry } from './Inquiry.js';
export { Conversation } from './Conversation.js';
export { Message } from './Message.js';
export { DeviceToken } from './DeviceToken.js';

export { Quotation } from './Quotation.js';
export { Deal } from './Deal.js';
export { Contract } from './Contract.js';
export { Order } from './Order.js';
export { Shipment } from './Shipment.js';
export { Escrow } from './Escrow.js';
export { Milestone } from './Milestone.js';

export { PayoutAccount } from './PayoutAccount.js';
export { PayoutRequest } from './PayoutRequest.js';

export { RefreshToken } from './RefreshToken.js';
export { OtpChallenge } from './OtpChallenge.js';
export { PendingSignup } from './PendingSignup.js';

export { Notification } from './Notification.js';
export { Ticket } from './Ticket.js';
export { TrustScore } from './TrustScore.js';

export { Lead } from './Lead.js';
export { Incentive } from './Incentive.js';
export { Investment } from './Investment.js';
export { PremiumApplication } from './PremiumApplication.js';
export { Subscription } from './Subscription.js';
// ⚠️ `Banner` is an empty unused skeleton that predates FINALIZE F5b. The real
// landing content lives in `FeaturedItem` (which covers banners too). Left in
// place rather than deleted — removing it is the owner's call.
export { Banner } from './Banner.js';
export { CmsPage } from './CmsPage.js';
export { FeaturedItem } from './FeaturedItem.js';

export { SCOPE, ownershipFilter, scopedFilter } from './scoping.js';
