import { Context } from "koa";
import { Core } from "@strapi/strapi";
import { PDFDocument, StandardFonts } from "pdf-lib";

import csvParser from "csv-parser";
import fs from "fs";
import { isValid } from "date-fns";
import axios from "axios";
import dayjs from "dayjs";

// Helper function to parse dates
function parseDate(dateStr) {
  if (!dateStr || dateStr === "-") return null;
  const [month, day, year] = dateStr.split("/").map(Number);
  if (!month || !day || !year) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  return isValid(date) ? date.toISOString() : null;
}

export function formatMMDDYYYY(date: Date | string): string {
  return date ? dayjs(date).format("MM/DD/YYYY") : "";
}
// Helper function to get lat/lng from Google Maps API
async function getLatLng(address) {
  if (!address) return null;
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const encoded = encodeURIComponent(address);
    const res = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`
    );
    console.log("res -==>>", res.data);
    const data = res.data;
    if (data.status === "OK" && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.error("Google Maps API error:", err.message);
  }
  return null;
}

export default {
  async summary(ctx: Context) {
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
      .whereIn("project_type", ["gas_emergency", "electric_emergency"])
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

  async generateProjectPDF(ctx: Context) {
    try {
      // const strapi = ctx.strapi as Core.Strapi;
      // Example: Get project data from your database
      const projectId = ctx.params.documentId;
      console.log({ projectId });
      const projectInfo = await strapi.db
        .query("api::project.project")
        .findOne({
          where: {
            documentId: projectId,
          },
        });
      if (!projectInfo) {
        return ctx.notFound("Project not found");
      }
      const project = {
        "Permit No": projectInfo.permit_no || "",
        "Layout No": projectInfo.layout_no,
        Year: projectInfo?.year,
        "Project Type": projectInfo.project_type,
        "Construction Start Date": projectInfo?.const_start_date
          ? formatMMDDYYYY(projectInfo?.const_start_date)
          : "-",
        "Construction End Date": projectInfo?.const_end_date
          ? formatMMDDYYYY(projectInfo?.const_end_date)
          : "-",
        "Restoration Start Date": projectInfo?.rest_start_date
          ? formatMMDDYYYY(projectInfo?.rest_start_date)
          : "-",
        "Restoration End Date": projectInfo?.rest_end_date
          ? formatMMDDYYYY(projectInfo?.rest_end_date)
          : "-",
        Town: projectInfo.town,
        Address: projectInfo?.address,
        Latitue: projectInfo?.lat ?? "-",
        Longitude: projectInfo?.lng ?? "-",
        "Permit Closeout": projectInfo?.permit_close_out ? "Yes" : "No",
        "Project Status": projectInfo?.project_status ?? "-",
      };

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create({});

      // Add a page
      const page = pdfDoc.addPage([600, 400]);
      const { height } = page.getSize();

      // Set font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 14;

      // Add content
      let y = height - 50;
      const lineHeight = 20;

      page.drawText("Project Information", { x: 50, y, size: 20, font });
      y -= 40;

      for (const [key, value] of Object.entries(project)) {
        page.drawText(`${key}: \t ${value}`, {
          x: 50,
          y,
          size: fontSize,
          font,
        });
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

  async uploadCsv(ctx: Context) {
    try {
      // File coming from <input type="file"> on frontend
      const file: any = ctx.request.files?.files;

      if (!file) {
        return ctx.badRequest("CSV file is required.");
      }

      const rows = [];

      console.log({ file });

      // Parse CSV file from the temporary uploaded file path
      await new Promise((resolve, reject) => {
        fs.createReadStream(file?.filepath)
          .pipe(csvParser())
          .on("data", (row) => rows.push(row))
          .on("end", resolve)
          .on("error", reject);
      });

      let processed = 0;

      const errorProjects: string[] = [];

      for (const row of rows) {
        if (!row["Permit #"]?.trim()) {
          continue; // Skip rows without Permit #
        }

        const project: any = {
          permit_no: row["Permit #"]?.trim(),
          year: row["Year"]?.trim(),
          address: row["Location"]?.trim(),
          town: row["Town"]?.trim(),
          layout_no: row["Layout #"]?.trim(),
          const_start_date: parseDate(
            row["Const.                   Start Date"]
          ),
          const_end_date: parseDate(row["Const.                   End Date"]),
          rest_start_date: parseDate(row["Rest.                 Start Date"]),
          rest_end_date: parseDate(row["Rest.                 End Date"]),
          remarks: row["Remarks"]?.trim() || null,
          project_type: "permit", // bug
        };

        if (row["Permit Closeout"]?.trim()) {
          project.permit_close_out =
            row["Permit Closeout"]?.trim() === "N" ||
            row["Permit Closeout"]?.trim()?.toLowerCase() === "no"
              ? false
              : true;
        }

        // Fetch lat/lng
        const geo = await getLatLng(project.address);
        console.log("geo ===>>>", geo);
        if (geo) {
          project.lat = geo.lat;
          project.lng = geo.lng;
        }

        // Check if existing
        const existing = await strapi.db.query("api::project.project").findOne({
          where: { permit_no: project.permit_no },
        });

        try {
          if (existing) {
            await strapi.db.query("api::project.project").update({
              where: { id: existing.id },
              data: project,
            });
          } else {
            await strapi.db.query("api::project.project").create({
              data: project,
            });
          }
        } catch (error) {
          console.error(
            `Error processing project with Permit # ${project.permit_no}:`,
            error
          );
          errorProjects.push(project.permit_no);
        }

        processed++;
      }

      ctx.body = {
        message: "CSV processed successfully",
        total: rows.length,
        errors: errorProjects,
        processed,
      };
    } catch (error) {
      console.error("Error processing CSV upload:", error);
      ctx.badRequest({ error: "Failed to process CSV file" });
    }
  },

  async countByDate(ctx) {
    const { year } = ctx.query;

    if (!year) {
      return ctx.badRequest("Year parameter is required");
    }

    try {
      const projects = await strapi.db.query("api::project.project").findMany({
        where: {
          const_start_date: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
        select: ["const_start_date"],
      });

      const counts = {};

      projects.forEach((p) => {
        const date = p.const_start_date;
        if (date) counts[date] = (counts[date] || 0) + 1;
      });

      const result = Object.keys(counts)
        .sort()
        .map((date) => ({ date, total: counts[date] }));

      return ctx.send(result);
    } catch (err) {
      console.error(err);
      return ctx.internalServerError("Something went wrong");
    }
  },

  async projectByType(ctx: Context) {
    // const strapi = ctx.strapi as Core.Strapi;
    const knex = strapi.db.connection;

    // Types for count queries
    interface CountResult {
      count: number;
    }

    const totalPermit = (await knex("projects")
      .where("project_type", "permit")
      .count("id as count")
      .first()) as unknown as CountResult;

    const totalGas = (await knex("projects")
      .where("project_type", "gas_emergency")
      .count("id as count")
      .first()) as unknown as CountResult;

    const totalElectric = (await knex("projects")
      .where("project_type", "electric_emergency")
      .count("id as count")
      .first()) as unknown as CountResult;

    ctx.body = {
      totalPermit: totalPermit.count,
      totalGas: totalGas.count,
      totalElectric: totalElectric.count,
    };
  },
};
