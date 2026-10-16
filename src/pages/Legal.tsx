import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { LEGAL, PRODUCT, TRIAL } from "../product";
import { LegalFooter, Wordmark } from "./Landing";

const contact = LEGAL.contactEmail
  ? <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold underline">{LEGAL.contactEmail}</a>
  : <span className="rounded bg-amber-100 px-1 font-semibold text-amber-900">[contact email to be added]</span>;

function Page({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = `${title} | ${PRODUCT.name}`; window.scrollTo(0, 0); }, [title]);
  return (
    <div className="min-h-screen bg-white font-sans text-plum">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-lilac">Sign in</Link>
      </header>
      <main className="mx-auto max-w-[72ch] px-4 pb-20 pt-6 sm:px-6">
        <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-sm text-plum-soft">Last updated {LEGAL.lastUpdated}</p>
        <div className="legal mt-8 space-y-4 text-[15.5px] leading-relaxed">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}

const H2 = ({ children }: { children: ReactNode }) => <h2 className="!mt-10 font-display text-2xl font-bold">{children}</h2>;
const H3 = ({ children }: { children: ReactNode }) => <h3 className="!mt-6 font-semibold">{children}</h3>;
const UL = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;

export function Privacy() {
  return (
    <Page title="Privacy notice">
      <p>
        This notice explains what personal data {PRODUCT.name} collects, why, and what your rights are.{" "}
        {PRODUCT.name} is run by {LEGAL.company}, {LEGAL.address}
        {LEGAL.companyNumber && <> ({LEGAL.companyNumber})</>}. For anything in this notice, contact us at {contact}.
      </p>
      <p>It covers two groups of people: people who have a {PRODUCT.name} account, and people who watch videos on pages made with {PRODUCT.name}.</p>

      <H2>If you have an account</H2>
      <p>For account holders, {LEGAL.company} is the data controller.</p>
      <H3>What we collect</H3>
      <UL>
        <li>Your name, email address and the name of your organisation.</li>
        <li>Your password, stored only in scrambled (hashed) form so nobody, including us, can read it.</li>
        <li>A record of when you accepted our terms and whether you asked for product news.</li>
        <li>The videos, images, text and settings you add to your workspace.</li>
        <li>Security information: sign-in times, the IP address used to sign in, and two-step verification settings if you switch it on.</li>
      </UL>
      <H3>Why we use it, and our lawful basis</H3>
      <UL>
        <li><strong>To provide the service</strong> you signed up for: running your account, hosting your videos and pages, and showing your stats. Lawful basis: contract.</li>
        <li><strong>To keep the service secure</strong>: the security check on sign-in and sign-up forms, and sign-in records used to spot misuse. Lawful basis: legitimate interests (protecting our customers and our systems).</li>
        <li><strong>To send service emails</strong> such as confirming your address and resetting your password. Lawful basis: contract.</li>
        <li><strong>To send product news</strong>, only if you ticked the box when signing up. Lawful basis: consent. You can withdraw it at any time using the unsubscribe link or by contacting us.</li>
        <li><strong>To meet legal obligations</strong>, such as keeping business and tax records. Lawful basis: legal obligation.</li>
      </UL>
      <p>Your email address and a password are needed to create an account. Without them we can't provide the service.</p>

      <H2>If you watch a video page</H2>
      <p>
        Video pages are published by the organisation named on the page (our customer). That organisation is the data controller for
        information about viewers, and {LEGAL.company} processes it on their behalf, following their instructions.
      </p>
      <H3>What is recorded</H3>
      <UL>
        <li>A random ID saved in your browser, so opening the same page twice isn't counted twice.</li>
        <li>Whether you're on a phone, tablet or computer.</li>
        <li>How much of the video you watched, and when.</li>
        <li>Which buttons, images or links on the page you tap.</li>
      </UL>
      <p>
        We don't record viewers' names, email addresses or IP addresses in these statistics, and video pages use no advertising cookies.
        The statistics are used only to show the organisation how its video performed.
      </p>
      <p>
        Every video page has an “About your privacy” link with a “Don't count my visits” button. Choosing it stops your visits being
        recorded on that device. To ask about anything else, contact the organisation that sent you the video. You can also contact us
        and we'll pass your request on.
      </p>

      <H2>Cookies and browser storage</H2>
      <p>We don't use advertising or tracking cookies anywhere.</p>
      <UL>
        <li><strong>This website and the dashboard</strong> save your signed-in session in your browser. This is strictly necessary for signing in, so it doesn't need consent.</li>
        <li><strong>Security check</strong>: sign-in and sign-up forms use Cloudflare Turnstile to block automated sign-ups. It's strictly necessary to keep the service secure.</li>
        <li><strong>Video pages</strong> save the random viewer ID described above. UK law allows this for statistics without asking first, as long as there's a simple way to opt out, which every page provides.</li>
      </UL>

      <H2>Who we share data with</H2>
      <p>We don't sell personal data. We use these service providers, who process data for us under contract:</p>
      <UL>
        <li><strong>Supabase</strong>: database, sign-in and file storage. Our database is hosted in London, UK.</li>
        <li><strong>Cloudflare</strong>: website hosting, video streaming, image delivery and the security check. Cloudflare runs a global network, so content is delivered from the location nearest the viewer.</li>
        <li><strong>Our email delivery provider</strong>: sends account emails such as confirmations and password resets.</li>
        <li><strong>Google Fonts</strong>: if an organisation chooses one of the optional fonts for its video page, the page loads it from Google. Google receives the viewer's IP address to deliver it.</li>
      </UL>
      <p>
        Some of these providers are based in, or may access data from, the United States. Where personal data leaves the UK we rely on
        UK adequacy regulations (including the UK–US data bridge) or the ICO's approved international data transfer agreement or addendum.
      </p>
      <p>We may also disclose information if the law requires it, or to protect the rights and safety of our users and others.</p>

      <H2>How long we keep it</H2>
      <UL>
        <li><strong>Account details and workspace content</strong>: for as long as your account is open. When you delete your account, they're deleted straight away from our live systems and drop out of our backups within 8 weeks.</li>
        <li><strong>Viewing statistics</strong>: for as long as the organisation keeps the video or workspace. Deleting a video deletes its statistics.</li>
        <li><strong>Records of consent to product news</strong>: for as long as we need to show you agreed, and no more than two years after you unsubscribe.</li>
        <li><strong>Business records</strong>: up to 6 years, where the law requires it.</li>
      </UL>

      <H2>Your rights</H2>
      <p>Under UK data protection law you have the right to:</p>
      <UL>
        <li>get a copy of your personal data</li>
        <li>have inaccurate data corrected</li>
        <li>have your data deleted</li>
        <li>restrict or object to how we use it</li>
        <li>receive your data in a portable format</li>
        <li>withdraw consent at any time, where we rely on consent</li>
      </UL>
      <p>
        You can delete your account yourself from the Account page in the dashboard. For anything else, contact us at {contact}.
        We'll reply within one month. We don't make any decisions about you using purely automated means.
      </p>
      <p>
        If you're unhappy with how we've handled your data, please tell us first so we can put it right. You can also complain to the
        Information Commissioner's Office at <a className="font-semibold underline" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">ico.org.uk</a> or on 0303 123 1113.
      </p>

      <H2>Changes to this notice</H2>
      <p>If we make important changes, we'll tell account holders by email or in the dashboard before they take effect.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of service">
      <p>
        These terms are an agreement between you (and the organisation you sign up for) and {LEGAL.company}, which runs {PRODUCT.name}.
        By creating an account you accept them. If you're signing up for an organisation, you confirm you're allowed to agree to them on its behalf.
      </p>

      <H2>1. The service</H2>
      <p>{PRODUCT.name} lets you upload videos, publish them on branded pages, link to those pages from emails, control when they're available, and see how they perform.</p>

      <H2>2. Your account</H2>
      <UL>
        <li>You must be at least 18 and use {PRODUCT.name} for business or organisational purposes.</li>
        <li>Give accurate details and keep them up to date.</li>
        <li>Keep your password safe and don't share your login. You're responsible for what happens in your account. Tell us straight away if you think someone else has used it.</li>
      </UL>

      <H2>3. Free trial and plans</H2>
      <p>
        New workspaces start on a free trial, which currently includes {TRIAL.videos} videos up to {TRIAL.maxMinutes} minutes each and
        {" "}{TRIAL.playsPerMonth} plays a month. Once the monthly plays are used up, pages show an “unavailable” message until the next month.
        We may change trial limits, and we'll give account holders notice before we do. Paid plans are agreed with us separately.
      </p>

      <H2>4. Your content</H2>
      <UL>
        <li>You keep ownership of everything you upload. You give us permission to store, convert, copy and display it only as needed to run the service for you.</li>
        <li>You must have the rights to everything you upload, including music, footage, logos and images, and the permission of anyone who appears in your videos.</li>
        <li>You're responsible for the emails you send linking to your pages, including having permission to email the people you send them to.</li>
        <li>Keep your own copies of your original videos. We back up page settings and statistics, but we can't guarantee a video file can always be recovered.</li>
      </UL>

      <H2>5. Acceptable use</H2>
      <p>Don't use {PRODUCT.name} to:</p>
      <UL>
        <li>publish anything illegal, defamatory, hateful, sexually explicit, violent or misleading, or anything that infringes someone else's rights</li>
        <li>send spam or phishing, or pretend to be someone you're not</li>
        <li>spread malware, or try to get round our security, limits or access controls</li>
        <li>overload the service, scrape it, or resell it without our written agreement</li>
      </UL>
      <p>We may remove content or suspend an account that breaks these rules. Where we can, we'll tell you first and give you a chance to put things right.</p>

      <H2>6. Data protection</H2>
      <p>
        Our <Link to="/privacy" className="font-semibold underline">privacy notice</Link> explains how we handle account holders' data.
        For data about people who watch your video pages, you're the controller and we're your processor. In that role we will:
      </p>
      <UL>
        <li>only process viewer data to provide the service and on your documented instructions, which are these terms and your settings</li>
        <li>make sure our staff and providers are bound by confidentiality</li>
        <li>keep the data secure using appropriate technical and organisational measures</li>
        <li>only use the providers listed in our privacy notice, tell you before adding or replacing one, and hold each to equivalent data protection terms</li>
        <li>help you respond to requests from individuals, and with your own security and data protection obligations</li>
        <li>tell you without undue delay if we become aware of a personal data breach affecting your data</li>
        <li>delete viewer data when you delete the video or workspace, or when your account closes</li>
        <li>give you the information you reasonably need to show these obligations are being met</li>
      </UL>
      <p>
        You're responsible for having a lawful basis for collecting viewing statistics and for telling your audience about it, for example in
        your own privacy policy. Every page shows a short privacy note and opt-out, and you can add a link to your privacy policy in your branding settings.
      </p>

      <H2>7. Availability</H2>
      <p>We work hard to keep {PRODUCT.name} running smoothly, but we can't promise it will always be available or error-free. We may need to make changes or carry out maintenance from time to time.</p>

      <H2>8. Ending your account</H2>
      <p>
        You can delete your account at any time from the Account page. We may suspend or close an account that seriously or repeatedly breaks
        these terms, or that has been inactive on a free trial for more than 12 months, after giving notice where we can. When an account is
        closed, its data is deleted as described in our privacy notice.
      </p>

      <H2>9. Liability</H2>
      <p>
        Nothing in these terms limits liability that can't legally be limited, such as for death or personal injury caused by negligence, or for fraud.
        Otherwise, we're not liable for indirect or consequential losses, or for loss of profit, revenue, data or goodwill. Our total liability to you
        under these terms in any 12 months is limited to the greater of £100 and the amount you paid us in that period.
      </p>

      <H2>10. Changes and general terms</H2>
      <p>
        We may update these terms. If a change is significant, we'll tell account holders before it takes effect. If you keep using {PRODUCT.name} afterwards,
        the new terms apply. These terms are governed by the law of England and Wales, and its courts have jurisdiction.
      </p>
      <p>Questions about these terms: {contact}.</p>
    </Page>
  );
}
