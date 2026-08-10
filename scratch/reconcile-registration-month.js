const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const uri = "mongodb+srv://syncforgesolutions_db_user:MySecurePassword12@cluster0.jq4axfo.mongodb.net/syncforge_db?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB Atlas.");

    const admissions = await mongoose.connection.db.collection("admissions").find({}).toArray();
    console.log(`Found ${admissions.length} admissions.`);

    let updatedCount = 0;
    let createdCount = 0;

    for (const adm of admissions) {
      // Determine effective admission date
      let admDate = adm.admissionDate ? new Date(adm.admissionDate) : null;
      if (!admDate || isNaN(admDate.getTime())) {
        admDate = adm.createdAt ? new Date(adm.createdAt) : new Date();
      }

      // Determine registration / initial collected amount
      const regAmt = Number(adm.registrationAmount !== undefined && adm.registrationAmount !== null ? adm.registrationAmount : (adm.amountReceivedToday || 0));

      // Find earliest or initial payment for this admission
      const firstPayment = await mongoose.connection.db.collection("payments").findOne(
        { admissionId: adm._id },
        { sort: { createdAt: 1 } }
      );

      if (firstPayment) {
        const curPayDate = firstPayment.paymentDate ? new Date(firstPayment.paymentDate) : null;
        const needsDateUpdate = !curPayDate || curPayDate.toISOString().slice(0, 10) !== admDate.toISOString().slice(0, 10);
        
        const updateFields = {
          paymentDate: admDate
        };

        if (regAmt > 0 && (!firstPayment.particulars || !firstPayment.particulars.registrationFeeDue)) {
          updateFields["particulars.registrationFeeDue"] = regAmt;
        }

        if (needsDateUpdate) {
          await mongoose.connection.db.collection("payments").updateOne(
            { _id: firstPayment._id },
            { $set: updateFields }
          );
          console.log(`Updated payment ${firstPayment._id} for ${adm.fullName}: payDate -> ${admDate.toISOString().slice(0, 10)} (was ${curPayDate ? curPayDate.toISOString().slice(0, 10) : 'none'})`);
          updatedCount++;
        }
      } else if (regAmt > 0) {
        // Create initial registration payment record if missing
        const receiptNo = `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await mongoose.connection.db.collection("payments").insertOne({
          receiptNo,
          admissionId: adm._id,
          studentName: adm.fullName || "Student",
          amountReceived: regAmt,
          paymentDate: admDate,
          paymentMode: adm.paymentMode || "Cash",
          referenceNo: adm.transactionNo || "N/A",
          company: adm.companyAssigned || "Cash",
          brand: adm.brand || "Cadd Mantra",
          particulars: {
            courseFeeDue: 0,
            registrationFeeDue: regAmt,
            materialFeeDue: 0,
            examFeeDue: 0
          },
          remarks: "Initial registration payment upon admission",
          createdAt: admDate,
          updatedAt: new Date()
        });
        console.log(`Created initial registration payment for ${adm.fullName}: ₹${regAmt} on ${admDate.toISOString().slice(0, 10)}`);
        createdCount++;
      }
    }

    console.log(`\nReconciliation Complete! Updated: ${updatedCount}, Created: ${createdCount}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
