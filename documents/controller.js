const moment = require('moment');
const { errorResponse, createResponse } = require("../utils/response")
const { Document } = require("./model")
const mongoose = require('mongoose')
const uploadDocuments = async (req, res) => {
  try {
      let updatedData;
      if (req.files && req.files.length > 0) {
        const fileDetails = req.files.map((file) => {
          return {
            fileName: file.originalname,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB', // Convert size to MB
            path: file.path.substring(file.path.indexOf('uploads')),
            uploadedAt: moment().format('DD-MM-YYYY hh:mm A'),
            uploadedBy:req.user._id
          };
        });

        const filter = {
          company: req.user.company._id,
          lead: req.body.leadId,
        };

        const update = {
          $push: {
            files: { $each: fileDetails },
          }
        };

        // Setting upsert to true to create a new document if it doesn't exist
        const options = { upsert: true, new: true };

        updatedData = await Document.findOneAndUpdate(filter, update, options);
      }

      // Your response logic
      return createResponse(res, 'Documents uploaded successfully!', updatedData);
  } catch (error) {
    console.log('Error while uploading documents : ', error);
    return errorResponse(res, 'Something went wrong while uploading docs!', null);
  }
};
const getDocumentsByLeadId = async (req, res) => {
  try {
    // Extract leadId from request parameters
    const leadId = req.params.leadId;

    let documents = await Document.aggregate([
      {
        $match: {
          'company': req.user.company._id,
          'lead': new mongoose.Types.ObjectId(leadId), // Convert leadId to ObjectId
        },
      },
      {
        $unwind: '$files', // Unwind the files array to access each file separately
      },
      {
        $lookup: {
          from: 'users',
          localField: 'files.uploadedBy',
          foreignField: '_id',
          as: 'files.uploadedBy',
        },
      },
      {
        $addFields: {
          'files.uploadedBy': {
            $arrayElemAt: ['$files.uploadedBy', 0], // Pick the first element from the array
          },
        },
      },
      {
        $group: {
          _id: '$_id',
          files: {
            $push: {
              fileName: '$files.fileName',
              size: '$files.size',
              path: '$files.path',
              uploadedAt: '$files.uploadedAt',
              uploadedBy: {
                $concat: ['$files.uploadedBy.firstName', ' ', '$files.uploadedBy.lastName'],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0, // Exclude the document _id
          company: 0, // Exclude the company field
          lead: 0, // Exclude the lead field
        },
      },
    ]);

    // Check if documents are found
    if (!documents || documents.length === 0) {
      return errorResponse(
        res,
        'No documents found for the given leadId',
        null
      );
    }

    // Your success response logic
    return createResponse(res, 'Documents retrieved successfully!', documents[0].files);
  } catch (error) {
    console.error('Error while fetching documents: ', error);

    // Handle the error using the errorResponse function
    return errorResponse(
      res,
      'Something went wrong while fetching documents',
      error.message
    );
  }
};






// Example createResponse function






module.exports = {
  uploadDocuments,
  getDocumentsByLeadId
}

