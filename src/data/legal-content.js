// =========================================================
// Legal documents for stonekrusher.com (KONSTRUCTZ)
// Single source of truth: used by the React LegalPage component
// and by generate-legal-pages.js (static, crawlable HTML).
//
// Body blocks:
//   'plain string'            -> paragraph
//   { list: ['a', 'b'] }      -> bullet list
//   { note: 'text' }          -> highlighted callout
// =========================================================

export const LEGAL_COMPANY = {
  brand: 'KONSTRUCTZ',
  site: 'stonekrusher.com',
  siteUrl: 'https://stonekrusher.com',
  addressLines: ['2522 S Malt Ave.', 'Commerce, CA 90040', 'United States'],
  phone: '+1 213-214-2203',
  email: 'sales@cwqv.com'
};

export const LEGAL_LAST_UPDATED = 'October 22, 2026';

export const LEGAL_DOCUMENTS = {
  terms: {
    key: 'terms',
    path: '/terms-of-service/',
    navLabel: 'Terms of Service',
    title: 'Terms of Service',
    seoTitle: 'Terms of Service | KONSTRUCTZ',
    seoDescription: 'Read the KONSTRUCTZ Terms of Service for stonekrusher.com: use of the website, quotes and orders, pricing, shipping, warranty, safe equipment use, and legal terms.',
    eyebrow: 'Legal',
    intro: 'These terms explain the rules for using stonekrusher.com and for requesting quotes, ordering equipment, or contacting KONSTRUCTZ.',
    summary: [
      'Equipment details, images, and prices on the site are for general information. A quote is not a binding sale until we confirm it in writing.',
      'You are responsible for operating machinery safely, legally, and with trained operators.',
      'Our liability is limited as described below, and California law governs these terms.'
    ],
    sections: [
      {
        id: 'acceptance',
        title: 'Acceptance of These Terms',
        body: [
          'These Terms of Service ("Terms") are a legal agreement between you and KONSTRUCTZ ("KONSTRUCTZ", "we", "us", or "our"), the operator of stonekrusher.com (the "Site"). By accessing or using the Site, requesting a quote, placing an order, or otherwise interacting with us, you agree to these Terms and to our Privacy Policy.',
          'If you do not agree, please do not use the Site. If you use the Site on behalf of a company or other organization, you confirm that you are authorized to bind that organization to these Terms.'
        ]
      },
      {
        id: 'services',
        title: 'About the Site and Our Services',
        body: [
          'The Site presents KONSTRUCTZ compact construction machinery, attachments, parts, guides, and support information. Through the Site you can browse equipment, request quotes, contact sales and support, read our blog, and, where available, purchase products through our online store.',
          'Our online store is powered by a third-party e-commerce platform (Ecwid). Payments and checkout on that platform are also subject to the platform provider\'s terms and privacy practices.'
        ]
      },
      {
        id: 'eligibility',
        title: 'Eligibility and Business Use',
        body: [
          'You must be at least 18 years old and able to form a binding contract to use the Site or buy from us. Our equipment is intended for commercial, agricultural, landscaping, and professional use, and for knowledgeable private owners who can operate it safely.'
        ]
      },
      {
        id: 'product-information',
        title: 'Product Information, Pricing, and Availability',
        body: [
          'We work to keep product descriptions, specifications, images, and prices accurate. However, specifications, engine options, colors, features, and accessories can change without notice, and images are for illustration and may show optional equipment.',
          'Prices and availability are subject to change at any time and may differ by location, freight, taxes, fees, and options. If we discover an error in a price, description, or availability, we may correct it and, if you have already ordered, give you the choice to confirm at the corrected terms or cancel.'
        ]
      },
      {
        id: 'quotes-orders',
        title: 'Quotes, Orders, and Payment',
        body: [
          'A quote request, a cart, or an order submission is an offer from you to purchase. No sale is complete until we confirm the order, price, and delivery terms in writing and, where required, receive payment or approved financing.',
          'We may refuse or cancel any order, limit quantities, or require a deposit or verification at our discretion, including where we suspect fraud, an error, or a compliance issue.',
          { list: [
            'You agree to provide accurate, current, and complete purchase and contact information.',
            'You are responsible for all applicable taxes, duties, registration, title, and freight charges unless the written quote states otherwise.',
            'Payment methods, deposits, and financing options are described in the quote or at checkout and may change.'
          ] }
        ]
      },
      {
        id: 'shipping',
        title: 'Shipping, Delivery, and Risk of Loss',
        body: [
          'Delivery dates are estimates and not guarantees. Freight and delivery are arranged as described in your quote or order confirmation. Unless we state otherwise in writing, risk of loss passes to you when the equipment is handed to the carrier or made available for pickup.',
          'Please inspect equipment on delivery and note any visible damage on the carrier\'s paperwork before signing. Report shipping damage or missing items to us promptly, and in any case within the period stated in your order documents.'
        ]
      },
      {
        id: 'returns-warranty',
        title: 'Returns and Limited Warranty',
        body: [
          'Return eligibility, restocking fees, and any cancellation terms are set out in your quote or order confirmation. Heavy equipment is generally not returnable once delivered unless it is defective or we agree otherwise in writing.',
          'KONSTRUCTZ equipment is covered by the limited warranty described on our Warranty information page and in the documents provided with your purchase. Warranty coverage applies to defects in materials and workmanship under normal use and does not cover wear items, misuse, lack of maintenance, accidents, unauthorized modifications, or use of non-approved parts or fluids.'
        ]
      },
      {
        id: 'safe-use',
        title: 'Safe and Lawful Use of Equipment',
        body: [
          'Operating construction and compact machinery is inherently dangerous. You are solely responsible for safe operation, jobsite safety, and compliance with all laws and regulations that apply to you, including operator training, workplace safety rules, emissions requirements, transport and road regulations, and underground utility checks before digging.',
          { list: [
            'Read the operator manual and all safety labels before use.',
            'Use only trained operators and appropriate personal protective equipment.',
            'Do not exceed rated capacities or modify safety systems.',
            'Maintain the equipment according to the service schedule.'
          ] },
          { note: 'Information on the Site, including blog articles and AI assistant answers, is general guidance only. It is not engineering, legal, safety, or financial advice. Always consult the manual and a qualified professional.' }
        ]
      },
      {
        id: 'accounts-content',
        title: 'Accounts, Comments, and Submissions',
        body: [
          'Some features, such as comments, inquiries, and the content management system, may require you to submit information. Staff and contributors with CMS access must keep their credentials confidential, use only their own account, and are responsible for activity under it.',
          'If you submit a comment, review, message, or other content, you confirm you have the right to do so and grant KONSTRUCTZ a non-exclusive, worldwide, royalty-free license to host, display, and use it in connection with the Site. We may remove content at our discretion.'
        ]
      },
      {
        id: 'acceptable-use',
        title: 'Acceptable Use',
        body: [
          'You agree not to misuse the Site. In particular, you will not:',
          { list: [
            'violate any law or infringe the rights of others;',
            'submit false, misleading, defamatory, or unlawful content;',
            'attempt to gain unauthorized access to the Site, the CMS, accounts, servers, or data;',
            'introduce malware, scrape the Site at a rate that burdens it, or interfere with its operation or security;',
            'use the Site to send spam or unsolicited promotions.'
          ] }
        ]
      },
      {
        id: 'intellectual-property',
        title: 'Intellectual Property',
        body: [
          'The Site and its content, including text, graphics, logos, product names, images, videos, layout, and software, are owned by KONSTRUCTZ or its licensors and are protected by copyright, trademark, and other laws. KONSTRUCTZ and related names and logos are trademarks of their respective owners.',
          'You may view and print Site content for your own personal or internal business use related to evaluating or buying our products. Any other use, including copying, republishing, or commercial reuse, requires our prior written permission.'
        ]
      },
      {
        id: 'third-party',
        title: 'Third-Party Links and Services',
        body: [
          'The Site may link to or integrate third-party services, such as our store platform, payment processors, social networks, fonts, and Google sign-in for authorized staff. We do not control these services and are not responsible for their content, availability, or practices. Your use of them is governed by their own terms and policies.'
        ]
      },
      {
        id: 'disclaimers',
        title: 'Disclaimer of Warranties',
        body: [
          'THE SITE AND ITS CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE FULLEST EXTENT PERMITTED BY LAW, KONSTRUCTZ DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, FOR THE SITE, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. We do not warrant that the Site will be uninterrupted, secure, or error-free.',
          'Products are covered only by the limited warranty described above and in your order documents. Some jurisdictions do not allow certain disclaimers, so some of the above may not apply to you.'
        ]
      },
      {
        id: 'liability',
        title: 'Limitation of Liability',
        body: [
          'TO THE FULLEST EXTENT PERMITTED BY LAW, KONSTRUCTZ AND ITS OWNERS, OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO THE SITE OR THESE TERMS.',
          'OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SITE OR A PURCHASE WILL NOT EXCEED THE AMOUNT YOU PAID TO US FOR THE PRODUCT OR SERVICE GIVING RISE TO THE CLAIM. Nothing in these Terms limits liability that cannot be limited by law.'
        ]
      },
      {
        id: 'indemnification',
        title: 'Indemnification',
        body: [
          'You agree to defend, indemnify, and hold harmless KONSTRUCTZ and its owners, officers, employees, and agents from claims, damages, losses, and expenses, including reasonable attorneys\' fees, arising from your misuse of the Site or equipment, your violation of these Terms or the law, or your content.'
        ]
      },
      {
        id: 'termination',
        title: 'Suspension and Termination',
        body: [
          'We may suspend or end your access to the Site or any account at any time, with or without notice, if we believe you have violated these Terms or created risk or legal exposure for us. Provisions that by their nature should survive termination will survive, including intellectual property, disclaimers, limitation of liability, indemnification, and governing law.'
        ]
      },
      {
        id: 'governing-law',
        title: 'Governing Law and Disputes',
        body: [
          'These Terms are governed by the laws of the State of California and applicable U.S. federal law, without regard to conflict-of-law rules. You and KONSTRUCTZ agree that any dispute will be brought exclusively in the state or federal courts located in Los Angeles County, California, and you consent to their jurisdiction, except where the law requires otherwise.',
          'Before filing a claim, please contact us so we can try to resolve the issue informally.'
        ]
      },
      {
        id: 'changes',
        title: 'Changes to These Terms',
        body: [
          'We may update these Terms from time to time. The "Last updated" date at the top shows when they last changed. Continued use of the Site after an update means you accept the revised Terms.'
        ]
      },
      {
        id: 'contact',
        title: 'Contact Us',
        body: [
          'Questions about these Terms? Contact KONSTRUCTZ using the details below.'
        ]
      }
    ]
  },

  privacy: {
    key: 'privacy',
    path: '/privacy-policy/',
    navLabel: 'Privacy Policy',
    title: 'Privacy Policy',
    seoTitle: 'Privacy Policy | KONSTRUCTZ',
    seoDescription: 'How KONSTRUCTZ collects, uses, shares, and protects personal information on stonekrusher.com, including quote requests, cookies, Google sign-in for staff, and your California privacy rights.',
    eyebrow: 'Legal',
    intro: 'Your privacy matters to us. This policy explains what information KONSTRUCTZ collects on stonekrusher.com, why we collect it, and the choices you have.',
    summary: [
      'We collect only the information needed to answer inquiries, process orders, support equipment owners, and run and secure the Site.',
      'We do not sell your personal information.',
      'You can ask us to access, correct, or delete your information at any time.'
    ],
    sections: [
      {
        id: 'scope',
        title: 'Who We Are and Scope',
        body: [
          'KONSTRUCTZ ("we", "us", "our") operates stonekrusher.com (the "Site"). This Privacy Policy describes how we handle personal information collected through the Site, our quote and contact forms, our online store, and our communications with you. It does not apply to third-party sites we link to.'
        ]
      },
      {
        id: 'information-we-collect',
        title: 'Information We Collect',
        body: [
          'We collect the following categories of information:',
          { list: [
            'Information you give us: name, company, email address, phone number, delivery address, equipment interests, and message content when you request a quote, contact sales or support, place an order, comment on an article, or chat with our assistant.',
            'Order and payment details: processed by our store platform and payment providers. We do not store full payment card numbers on our servers.',
            'Technical and usage data: IP address, browser and device type, pages viewed, referring pages, and approximate location derived from IP address, collected through server logs and similar technologies.',
            'Browser storage data: cart contents, saved inquiries, viewed items, and display preferences kept in your browser (see Cookies and Local Storage).',
            'Staff account data: for authorized CMS users, name, email address, role, login history, and security logs, including sign-in through Google where enabled.'
          ] }
        ]
      },
      {
        id: 'how-we-use',
        title: 'How We Use Information',
        body: [
          'We use personal information to:',
          { list: [
            'respond to quote requests, support requests, and other inquiries;',
            'process orders, arrange delivery, provide warranty and parts support, and handle financing questions;',
            'operate, maintain, and improve the Site, content, and product information;',
            'protect the Site and our users, detect fraud and abuse, and enforce our Terms of Service;',
            'send service messages and, where permitted, marketing updates you can opt out of at any time;',
            'comply with legal obligations and resolve disputes.'
          ] }
        ]
      },
      {
        id: 'cookies',
        title: 'Cookies and Local Storage',
        body: [
          'We and our service providers use cookies, local storage, and similar technologies. Some are essential, such as keeping items in your cart, remembering your saved inquiries, and keeping authorized staff securely signed in to the CMS with an HttpOnly session cookie. Others help us understand how the Site is used.',
          'You can block or delete cookies and local storage in your browser settings. Some Site features may not work properly if you do.'
        ]
      },
      {
        id: 'sharing',
        title: 'How We Share Information',
        body: [
          'We do not sell your personal information. We share it only as described here:',
          { list: [
            'Service providers who help us run the Site and business, such as web hosting, our e-commerce and checkout platform (Ecwid), payment processors, email and communication tools, and freight and shipping carriers. They may use the information only to provide services to us.',
            'Legal and safety: when required by law or legal process, or to protect the rights, property, or safety of KONSTRUCTZ, our customers, or others.',
            'Business transfers: in connection with a merger, financing, or sale of all or part of our business.',
            'With your direction or consent.'
          ] }
        ]
      },
      {
        id: 'google',
        title: 'Google and Other Third-Party Services',
        body: [
          'Authorized staff may sign in to the CMS using Google Sign-In. When this is used, Google provides us with your verified email address and basic profile details so we can match you to an existing staff account. We do not receive your Google password, and we do not access your Google contacts, mail, or files. Google\'s own Privacy Policy governs its handling of your data.',
          'The Site may also load fonts and other resources from Google, and includes links to social networks such as TikTok, Pinterest, Tumblr, X, Facebook, and Instagram. Those services may collect information about you under their own policies when you interact with them.'
        ]
      },
      {
        id: 'retention',
        title: 'Data Retention',
        body: [
          'We keep personal information only as long as needed for the purposes described in this policy, including to complete transactions, provide warranty and support, meet legal, tax, and accounting requirements, and resolve disputes. Security and audit logs for staff accounts are kept for a limited period and then deleted or anonymized.'
        ]
      },
      {
        id: 'security',
        title: 'Security',
        body: [
          'We use reasonable administrative, technical, and organizational safeguards to protect personal information, including encrypted connections (HTTPS), hashed passwords, access controls, login lockouts, and audit logging for our CMS. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.'
        ]
      },
      {
        id: 'your-choices',
        title: 'Your Choices and Rights',
        body: [
          'You may contact us at any time to request access to, correction of, or deletion of the personal information we hold about you, or to opt out of marketing emails. You can also unsubscribe using the link in any marketing email. We may need to verify your identity before acting on a request, and we may retain information we are required or permitted by law to keep.'
        ]
      },
      {
        id: 'california',
        title: 'California Privacy Rights',
        body: [
          'If you are a California resident, the California Consumer Privacy Act (as amended by the CPRA) gives you the right to know what personal information we collect, use, and disclose; to request deletion or correction; to opt out of the sale or sharing of personal information; and to not be discriminated against for exercising these rights.',
          { list: [
            'We collect the categories of information listed above (identifiers, commercial information, internet activity, and location data derived from IP address) for the business purposes described in this policy.',
            'We do not sell personal information and do not share it for cross-context behavioral advertising.',
            'To exercise your rights, email us using the contact details below. You may use an authorized agent, and we will verify your request.',
            'California\'s "Shine the Light" law lets California residents ask which personal information we have disclosed to third parties for their direct marketing purposes. We do not make such disclosures.'
          ] }
        ]
      },
      {
        id: 'children',
        title: 'Children\'s Privacy',
        body: [
          'The Site is intended for adults and businesses and is not directed to children under 18. We do not knowingly collect personal information from children. If you believe a child has provided us information, please contact us and we will delete it.'
        ]
      },
      {
        id: 'international',
        title: 'International Visitors',
        body: [
          'We are based in the United States and the Site is operated from the United States. If you access it from elsewhere, your information will be transferred to, stored, and processed in the United States, where data protection laws may differ from those in your country.'
        ]
      },
      {
        id: 'changes',
        title: 'Changes to This Policy',
        body: [
          'We may update this Privacy Policy from time to time. We will post the updated version on this page and revise the "Last updated" date. Please review it periodically.'
        ]
      },
      {
        id: 'contact',
        title: 'Contact Us',
        body: [
          'For privacy questions or to exercise your rights, contact KONSTRUCTZ using the details below.'
        ]
      }
    ]
  }
};

export const LEGAL_DOCUMENT_LIST = [LEGAL_DOCUMENTS.terms, LEGAL_DOCUMENTS.privacy];
