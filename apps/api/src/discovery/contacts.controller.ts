import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { ProjectContact } from '@project-maker/contracts';

import { ContactsService } from './contacts.service';
import { SaveProjectContactDto } from './dto/save-project-contact.dto';

@Controller('projects/:projectId/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly ProjectContact[]> {
    return this.contacts.list(projectId);
  }

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: SaveProjectContactDto,
  ): Promise<ProjectContact> {
    return this.contacts.create(projectId, input);
  }

  @Patch(':contactId')
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
    @Body() input: SaveProjectContactDto,
  ): Promise<ProjectContact> {
    return this.contacts.update(projectId, contactId, input);
  }

  @Delete(':contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
  ): Promise<void> {
    return this.contacts.delete(projectId, contactId);
  }
}
