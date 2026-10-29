# Marketing Page Guide

The Marketing page is the staff workspace for guest loyalty, customer segments, promotions, gift cards, direct-order previews, and review settings. Open **Marketing Hub** in the sidebar or go to `/marketing` after signing in.

## Start Here

1. Open **Marketing Hub** from the Marketing section of the sidebar.
2. Use the tabs below the page title to choose a workflow.
3. Set up customer profiles and consent before creating campaigns.
4. Check the provider notes in each section before promising that a message, payment, or guest-facing link is live.

The page uses the same restaurant data store as Customers, POS, Orders, and Promotions. Changes save with the rest of the restaurant data.

## Overview

The overview shows the current number of guest profiles, active promotions, gift-card balance, and campaign drafts. Its links take you to the related Marketing tab or the Customers page. Provider cards show whether SMS, email, Meta Ads, or Google Ads still need setup.

## Loyalty & CRM

### Points and VIP tiers

- Points are earned when a completed POS order is attached to a customer profile.
- Configure points per currency unit and the minimum points needed to redeem.
- VIP status is assigned when a customer reaches the configured lifetime-spend or visit threshold. Other customers are marked Frequent after 10 visits, or Regular otherwise.
- Point redemptions and earnings are listed in the existing Customers loyalty history.

### Punch cards

- Turn the punch-card program on, choose the number of visits required, and enter the reward description.
- Completed POS visits add punches when the order is linked to a customer.
- Open that customer's profile in **Customers** to see punches and redeem an earned reward.
- Staff should provide the configured reward manually. The app records the redemption, but it does not automatically add a discount or free item to the POS order.

### Customer profiles

Manage profiles in **Customers**. Profiles support phone, email, birthday, anniversary, dietary preferences, SMS/email marketing consent, visit count, lifetime spend, points, and order history. A customer needs to be selected or matched by phone for POS orders to update their visit and loyalty information.

## Campaigns

Create a draft by choosing a name, SMS or Email channel, audience, optional schedule, and message. Audience options include all guests, VIP, inactive for 30 or more days, birthdays this month, and anniversaries this month.

The estimated recipient count includes only guests who opted into the selected channel and have the required contact detail. Saving creates a **draft**. It does not send or schedule a message; connect a messaging provider and complete consent/compliance setup before delivery is available.

## Ordering & Upsells

### Direct ordering and QR codes

- Set the guest-facing ordering URL and enable the direct-ordering preview.
- The page generates a QR code for each configured table. Without a custom URL, it uses the current app address and `/order?table=...`.
- Do not print or distribute these codes for public ordering yet. The current restaurant data API is private to signed-in owners; a guest on another device cannot safely load the restaurant menu or submit a live order. A secure public storefront/API and payment integration are required.
- The current `/order` route is a local preview, not a production commission-free ordering and payment service.

### Checkout upsells

Choose a cart item and the suggested add-on, then select **Add suggestion**. Active rules appear in both the POS cart and direct-order preview when the trigger item is present and the add-on is not already in the cart. Staff can pause or reactivate rules.

## Reviews & Wi-Fi

### Reviews

- Configure the post-visit delay, positive-rating threshold, and Google/Yelp review URLs.
- Turn on automated post-visit requests to queue a request when a completed POS order has a linked customer with a phone or email address.
- Requests are stored with a scheduled time and shown as awaiting a provider. No SMS or email is sent until a messaging provider is connected.
- Use **Record feedback** to save feedback manually. Ratings at or above the threshold are marked positive and can link to the configured review site; lower ratings are flagged for manager follow-up.

### Guest Wi-Fi

The portal URL and email/phone capture preferences are configuration notes only. Captive-portal login and guest-list capture require a compatible Wi-Fi access point or portal provider; this page does not intercept Wi-Fi connections.

## Gift Cards

- Select **Issue gift card**, set an amount, and optionally enter purchaser, recipient, and expiry date.
- The app generates a gift-card code and tracks its remaining balance.
- Staff can redeem a balance from this page or select **Gift Card** as the POS payment method and enter the card code.
- POS redemption validates the code, expiry, and available balance, then deducts the used amount when the order completes.
- Online sale, email/SMS delivery, and third-party payment processing are not connected.

## Promos & Ads

### Promo tracking

The performance table counts completed orders whose coupon code matches a promotion, and shows attributed sales, discount cost, and sales-to-discount ratio. This ratio is an efficiency indicator, not incremental profit or a fully attributed advertising ROI.

Manage codes in **Promotions & Discounts**. Promotions can have a date range, maximum redemption count, one-use-per-customer rule, and optional happy-hour time range. POS checks these rules when a coupon is applied; redemption counts update when an order completes. Single-use codes require a customer profile to be selected at POS.

### Ad audiences

The page shows available VIP, win-back, birthday, and anniversary segments. Meta and Google sync are not connected. Do not expect guest data to be exported or sent to an ad platform until a secure OAuth integration and applicable consent workflow are implemented.

## What Requires Setup

| Feature | Current status | Needed for production |
| --- | --- | --- |
| Points, VIP tiers, punch progress | Works with completed POS orders linked to profiles | Staff must select the customer; configure reward fulfillment |
| Campaign creation | Saves drafts and estimates opted-in recipients | SMS/email provider, delivery scheduling, unsubscribe/compliance handling |
| QR menu and guest ordering | Local preview and table QR generation | Public menu/order API, public hosting/domain, payment provider |
| Checkout upsells | Rules appear in POS and local ordering preview | Public storefront integration for external guests |
| Review requests | Queued in the restaurant data store | SMS/email provider and scheduled job/worker |
| Guest Wi-Fi capture | Settings can be saved | Compatible captive-portal/Wi-Fi provider |
| Gift cards | Codes, balances, manual and POS redemption | Online purchase/delivery and payment-provider integration |
| Meta/Google audiences | Segment counts only | OAuth connectors, consent checks, and platform-specific sync |

## Troubleshooting

- **No campaign recipients:** Check that guests have a phone/email address and the matching channel opt-in is selected on their profile.
- **No loyalty points or punch:** Confirm the order was completed and a customer profile was attached before completion.
- **Coupon rejected:** Check active status, start/end dates, redemption cap, happy-hour window, and whether a single-use coupon was previously used by that customer.
- **QR code does not work for a guest:** The current QR destination is not backed by a public guest API. Do not distribute it as a live ordering link yet.
- **Gift card cannot be used:** Check the code, remaining balance, and expiry date.

