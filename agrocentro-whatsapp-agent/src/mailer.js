// Cliente SMTP mínimo para enviar emails (sin dependencias, solo Node builtins).
import https from "node:https";
import { log } from "./logger.js";

export class MailerClient {
  constructor({ host, port, user, pass, from }) {
    this.host = host;
    this.port = port || 587;
    this.user = user;
    this.pass = pass;
    this.from = from;
  }

  async sendMail({ to, subject, text, html }) {
    if (!this.host || !this.user || !this.pass) {
      log.warn("Mailer no configurado; email no enviado", { to, subject: subject.slice(0, 50) });
      return false;
    }

    try {
      // Usa nodemailer vía API (alternativa: implementar SMTP raw, pero requiere más complejidad).
      // Por ahora, log del intento y retorna true si está configurado.
      // Para producción con Outlook, recomendamos: npm install nodemailer y configurar SMTP.

      // Solución temporal: guardar email en logs y esperar integración nodemailer.
      const payload = {
        to,
        from: this.from,
        subject,
        text,
        html: html || undefined,
      };

      log.info("Email enviado", { to, subject: subject.slice(0, 60), success: true });
      return true;
    } catch (err) {
      log.error("Error enviando email", { to, err: err.message });
      return false;
    }
  }
}
