import { Context } from "koa";
import { Core } from "@strapi/strapi";

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export default {
  async summary(ctx: Context) {
    const strapi = ctx.strapi as Core.Strapi;
    const knex = strapi.db.connection;

    // Types for count queries
    interface CountResult {
      count: number;
    }

    const totalPermit = (await knex("projects")
      .where("project_type", "permit")
      .count("id as count")
      .first()) as unknown as CountResult;

    const totalEmergency = (await knex("projects")
      .whereIn("project_type", ["gas", "electric"])
      .count("id as count")
      .first()) as unknown as CountResult;

    const completedConstructions = (await knex("projects")
      .whereNotNull("const_start_date")
      .whereNotNull("const_end_date")
      .count("id as count")
      .first()) as unknown as CountResult;

    const completedRestorations = (await knex("projects")
      .whereNotNull("rest_start_date")
      .whereNotNull("rest_end_date")
      .count("id as count")
      .first()) as unknown as CountResult;

    ctx.body = {
      totalPermit: totalPermit.count,
      totalEmergency: totalEmergency.count,
      completedConstructions: completedConstructions.count,
      completedRestorations: completedRestorations.count,
    };
  },

  // Install dependencies:
  // npm install pdf-lib

  async generateProjectPDF(ctx: Context) {
    try {
      const strapi = ctx.strapi as Core.Strapi;
      // Example: Get project data from your database
      const project = {
        permit_no: "P12345",
        year: 2025,
        layout_no: "L001",
        town: "Springfield",
        project_type: "Electric Emergency",
        const_start_date: "2025-01-10",
        const_end_date: "2025-05-15",
        address: "123 Main St, Springfield",
      };

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Add a page
      const page = pdfDoc.addPage([600, 400]);
      const { width, height } = page.getSize();

      // Set font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 14;

      // Add content
      let y = height - 50;
      const lineHeight = 20;

      page.drawText("Project Information", { x: 50, y, size: 20, font });
      y -= 40;

      for (const [key, value] of Object.entries(project)) {
        page.drawText(`${key}: ${value}`, { x: 50, y, size: fontSize, font });
        y -= lineHeight;
      }

      // Serialize PDF to bytes
      const pdfBytes = await pdfDoc.save();

      // Set response headers

      // Send the PDF
      ctx.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("Error generating PDF:", error);
      ctx.badRequest({ error: "Failed to generate PDF" });
    }
  },
};
