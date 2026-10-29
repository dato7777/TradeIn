import React, { type ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { alertsCopy, fill } from "@/lib/alertsCopy";
import { formatIls } from "@/lib/public/format";
import type { PublicLocale } from "@/lib/publicCopy";

const font = "Arial, Helvetica, sans-serif";

function money(amount: number): string {
  return new Intl.NumberFormat("en").format(amount);
}

function subject(value: string, ad: boolean, locale: PublicLocale): string {
  const clean = value.replace(/[\r\n]+/g, " ").slice(0, 180);
  return ad ? `${alertsCopy[locale].email.ad}${clean}` : clean;
}

function Shell({
  locale,
  siteName,
  children,
}: {
  locale: PublicLocale;
  siteName: string;
  children: ReactNode;
}) {
  const dir = locale === "he" ? "rtl" : "ltr";
  return (
    <Html lang={locale} dir={dir}>
      <Head />
      <Body style={{ backgroundColor: "#F8FAFC", margin: 0, padding: "24px 12px", fontFamily: font }}>
        <Container
          dir={dir}
          style={{
            backgroundColor: "#ffffff",
            maxWidth: "600px",
            borderRadius: "12px",
            padding: "24px",
            color: "#0F172A",
          }}
        >
          <Text style={{ color: "#0F172A", fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>{siteName}</Text>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

export function ConfirmationEmail(props: {
  locale: PublicLocale;
  siteName: string;
  phone: string;
  price: string | null;
  confirmUrl: string;
  unsubscribeUrl: string;
  replyTo: string;
  hours: number;
}) {
  const t = alertsCopy[props.locale].email;
  const dir = props.locale === "he" ? "rtl" : "ltr";
  const align = props.locale === "he" ? "right" : "left";
  return (
    <Shell locale={props.locale} siteName={props.siteName}>
      <Text style={{ color: "#0F172A", fontSize: "16px", lineHeight: "24px", textAlign: align, margin: "0 0 12px" }}>
        {fill(t.confirmIntro, { phone: props.phone })}
      </Text>
      <Text style={{ color: "#0F172A", fontSize: "16px", lineHeight: "24px", textAlign: align, margin: "0 0 16px" }}>
        {props.price ? fill(t.confirmPrice, { price: props.price }) : t.noPrice}
      </Text>
      <Section style={{ textAlign: "center", margin: "0 0 16px" }}>
        <Button
          href={props.confirmUrl}
          style={{
            backgroundColor: "#1D4ED8",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: 700,
          }}
        >
          {alertsCopy[props.locale].confirmButton}
        </Button>
      </Section>
      <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "22px", textAlign: align, margin: "0 0 8px" }}>
        {t.confirmIgnore}
      </Text>
      <Text style={{ color: "#475569", fontSize: "14px", lineHeight: "22px", textAlign: align, margin: "0 0 16px" }}>
        {fill(t.confirmExpires, { hours: String(props.hours) })}
      </Text>
      <Footer
        locale={props.locale}
        siteName={props.siteName}
        phone={props.phone}
        unsubscribeUrl={props.unsubscribeUrl}
        replyTo={props.replyTo}
        retention={false}
        dir={dir}
      />
    </Shell>
  );
}

export function AlertEmail(props: {
  locale: PublicLocale;
  siteName: string;
  kind: "up" | "down" | "available";
  phone: string;
  model: string;
  oldPrice: number | null;
  newPrice: number;
  percent: number;
  offers: { company: string; price: number }[];
  offerUrl: string;
  unsubscribeUrl: string;
  replyTo: string;
}) {
  const copy = alertsCopy[props.locale];
  const t = copy.email;
  const align = props.locale === "he" ? "right" : "left";
  const badge =
    props.kind === "up"
      ? { label: t.up, color: "#047857", background: "#ECFDF5" }
      : props.kind === "down"
        ? { label: t.down, color: "#B45309", background: "#FFFBEB" }
        : { label: t.offers, color: "#1D4ED8", background: "#EFF6FF" };
  const change =
    props.kind === "available" || props.oldPrice == null
      ? formatIls(props.newPrice, props.locale)
      : `${t.was} ${formatIls(props.oldPrice, props.locale)} ${t.arrow} ${t.now} ${formatIls(props.newPrice, props.locale)} (${Math.round(props.percent)}%)`;
  return (
    <Shell locale={props.locale} siteName={props.siteName}>
      <Text
        style={{
          color: badge.color,
          backgroundColor: badge.background,
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: "999px",
          fontSize: "14px",
          fontWeight: 700,
          margin: "0 0 12px",
        }}
      >
        {badge.label}
      </Text>
      <Text style={{ color: "#0F172A", fontSize: "16px", textAlign: align, margin: "0 0 8px" }}>{props.phone}</Text>
      <Text style={{ color: "#0F172A", fontSize: "28px", fontWeight: 700, textAlign: align, margin: "0 0 16px" }}>
        {change}
      </Text>
      {props.offers.map((offer) => (
        <Text key={`${offer.company}-${offer.price}`} style={{ color: "#0F172A", fontSize: "15px", textAlign: align, margin: "0 0 4px" }}>
          {offer.company} · {formatIls(offer.price, props.locale)}
        </Text>
      ))}
      <Section style={{ textAlign: "center", margin: "16px 0" }}>
        <Button
          href={props.offerUrl}
          style={{
            backgroundColor: "#1D4ED8",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: 700,
          }}
        >
          {t.seeOffers}
        </Button>
      </Section>
      <Text style={{ color: "#475569", fontSize: "13px", lineHeight: "20px", textAlign: align, margin: "0 0 16px" }}>
        {t.disclaimer}
      </Text>
      <Footer
        locale={props.locale}
        siteName={props.siteName}
        phone={props.phone}
        unsubscribeUrl={props.unsubscribeUrl}
        replyTo={props.replyTo}
        retention
        dir={props.locale === "he" ? "rtl" : "ltr"}
      />
    </Shell>
  );
}

function Footer(props: {
  locale: PublicLocale;
  siteName: string;
  phone: string;
  unsubscribeUrl: string;
  replyTo: string;
  retention: boolean;
  dir: "rtl" | "ltr";
}) {
  const copy = alertsCopy[props.locale];
  const align = props.dir === "rtl" ? "right" : "left";
  return (
    <>
      <Hr style={{ borderColor: "#E2E8F0", margin: "8px 0 16px" }} />
      <Text style={{ color: "#475569", fontSize: "12px", lineHeight: "18px", textAlign: align, margin: "0 0 6px" }}>
        {props.siteName}
      </Text>
      <Text style={{ color: "#475569", fontSize: "12px", lineHeight: "18px", textAlign: align, margin: "0 0 6px" }}>
        {fill(copy.email.why, { phone: props.phone })}
      </Text>
      <Text style={{ color: "#475569", fontSize: "12px", lineHeight: "18px", textAlign: align, margin: "0 0 6px" }}>
        <a href={props.unsubscribeUrl} style={{ color: "#1D4ED8" }}>
          {copy.unsubTitle}
        </a>
      </Text>
      <Text style={{ color: "#475569", fontSize: "12px", lineHeight: "18px", textAlign: align, margin: "0 0 6px" }}>
        {props.replyTo}
      </Text>
      {props.retention ? (
        <Text style={{ color: "#475569", fontSize: "12px", lineHeight: "18px", textAlign: align, margin: 0 }}>
          {copy.email.retention}
        </Text>
      ) : null}
    </>
  );
}

export type RenderedMail = { subject: string; html: string; text: string };

export async function renderConfirmation(props: {
  locale: PublicLocale;
  siteName: string;
  phone: string;
  priceLabel: string | null;
  confirmUrl: string;
  unsubscribeUrl: string;
  replyTo: string;
  hours: number;
  adLabel: boolean;
}): Promise<RenderedMail> {
  const element = (
    <ConfirmationEmail
      locale={props.locale}
      siteName={props.siteName}
      phone={props.phone}
      price={props.priceLabel}
      confirmUrl={props.confirmUrl}
      unsubscribeUrl={props.unsubscribeUrl}
      replyTo={props.replyTo}
      hours={props.hours}
    />
  );
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: subject(alertsCopy[props.locale].email.confirmSubject, props.adLabel, props.locale), html, text };
}

export async function renderAlert(props: {
  locale: PublicLocale;
  siteName: string;
  kind: "up" | "down" | "available";
  phone: string;
  model: string;
  oldPrice: number | null;
  newPrice: number;
  percent: number;
  offers: { company: string; price: number }[];
  offerUrl: string;
  unsubscribeUrl: string;
  replyTo: string;
  adLabel: boolean;
}): Promise<RenderedMail> {
  const element = <AlertEmail {...props} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const key = props.kind === "up" ? "rose" : props.kind === "down" ? "dropped" : "available";
  const line = fill(alertsCopy[props.locale].email[key], { model: props.model, price: money(props.newPrice) });
  return { subject: subject(line, props.adLabel, props.locale), html, text };
}

export function groupedPrice(amount: number): string {
  return money(amount);
}
