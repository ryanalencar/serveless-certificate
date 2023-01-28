import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { join } from "path";
import handlebars from 'handlebars'
import { readFileSync } from "fs";
import dayjs from 'dayjs'
import chromium from "chrome-aws-lambda";
import { S3 } from 'aws-sdk'
import { document } from '../utils/dynamodbClient'

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string
}

interface ICertificateTemplate {
  id: string;
  name: string;
  grade: string;
  medal: string;
  date: string;
}

const compileCertificateTemplate = async (data: ICertificateTemplate) => {
  const templatePath = join(process.cwd(), 'src', 'templates', 'certificate.hbs')
  const templateHtml = readFileSync(templatePath, 'utf-8')

  return handlebars.compile(templateHtml)(data)
}

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate

  const response = await document.query({
    TableName: 'users_certificate',
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise()

  const userAlreadyExists = response.Items[0]

  if (!userAlreadyExists) {
    await document.put({
      TableName: 'users_certificate',
      Item: {
        id,
        name,
        grade,
        created_at: new Date().getTime()
      }
    }).promise()
  }

  const medalPath = join(process.cwd(), "src", "templates", "selo.png")
  const medal = readFileSync(medalPath, "base64")

  const data: ICertificateTemplate = {
    date: dayjs().format("DD/MM/YYYY"),
    grade,
    id,
    medal,
    name
  }

  const templateContent = await compileCertificateTemplate(data)

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    userDataDir: '/dev/null'
  })

  const page = await browser.newPage()

  await page.setContent(templateContent)
  const pdf = await page.pdf({
    format: 'a4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    path: process.env.IS_OFFLINE ? "./certificate.pdf" : null,
  })

  await browser.close()

  const s3 = new S3()

  await s3.putObject({
    Bucket: 'certificate-ignitenode',
    Key: `${id}.pdf`,
    ACL: 'public-read',
    Body: pdf,
    ContentType: 'application/pdf'
  }).promise()

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: 'Certificado criado com sucesso!',
      url: `https://certificate-ignitenode.s3.amazonaws.com/${id}.pdf`
    })
  }
}
