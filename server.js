'use strict';

const cors = require('cors');
const express = require('express');
const fileUpload = require('express-fileupload');
const AStar = require('jshpp').AStar;
const morgan = require('morgan');
const path = require('path');

const app = express();
const port = process.env.PORT || 80;

const fileSizeInMB = 5;
app.use(fileUpload({
    createParentPath: true,
    limits: {
        fileSize: fileSizeInMB * 1024 * 1024 * 1024
    }
}));
app.use(cors());
app.use(express.json({limit: '10mb', extended: true}));
app.use(express.urlencoded({limit: '10mb', extended: true}));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '/')));

app.set('port', port);
const server = app.listen(app.get('port'), function () {
    console.log(`Running on http://${server.address().address}:${app.get('port')}`);
});

app.all('/*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    next();
});

const getPath = (scenario) => {
    try {
        const aStar = new AStar(scenario);
        const result = aStar.calculatePath();
        const elapsedMS = result.elapsed_ms;
        const path = result.path;
        const refinedPath = result.refined_path;
        const resultMessage = result.message;
        // console.log(path);

        return { elapsedMS, path, refinedPath, resultMessage };
    } catch (err) {
        console.error(err);
    }
};

const responsePath = (file, elapsedMS, path, resultMessage, res) => {
    res.send({
        status: true,
        message: resultMessage,
        data: {
            name: file.name,
            size: file.size,
            elapsedMS,
            path
        }
    });
};

const responsePathFromBuffer = (file, res) => {
    const fileDataString = Buffer.from(file.data).toString();
    const jsonObject = JSON.parse(fileDataString);

    try {
        const { elapsedMS, path, refinedPath, resultMessage } = getPath(jsonObject);
        responsePath(file, elapsedMS, path, resultMessage, res);
    } catch (err) {
        console.error(err);
    }
};

const postUrl = '/';
app.post(postUrl, async (req, res) => {
    try {
        if (!req.files) {
            if (!req.body) {
                res.send({
                    status: false,
                    message: `Neither file is uploaded nor body exists in the request.`
                });
            } else {
                console.log(`Accessing from URL...`);

                const jsonObject = req.body;

                const hasGrouping = jsonObject.grouping;
                const isGrouping = hasGrouping ? Number(hasGrouping.radius) ? true : false : false;

                const { elapsedMS, path, refinedPath, resultMessage } = getPath(jsonObject);

                res.send({
                    status: true,
                    message: resultMessage,
                    grouping: isGrouping,
                    data: {
                        elapsedMS,
                        path,
                        refinedPath
                    }
                });
            }
        } else {
            console.log(`Accessing from web...`);

            const file = req.files.json;
            
            responsePathFromBuffer(file, res);
        }
    } catch (err) {
        res.status(500).send(err);
    }
});
